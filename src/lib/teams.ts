import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { entitlementsFor } from "./entitlements";
import { appUrl, sendMail } from "./mail";

// Teams (Pro). The account owner invites people by email; each signs in with their own login and works in the
// owner's account: the same monitors, alerts and settings. Only the owner manages the team. Someone is in at most one
// team, and only joins by accepting an invitation sent to their own address, while signed in as that address.
//
// While someone is a member, everything they do happens in the owner's account (see currentUser in auth.ts). Their own
// account, if they had one, keeps running untouched, and is theirs again when they leave.

const INVITE_DAYS = 7;
const DAY = 86_400_000;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** The account a person works in, when it isn't their own: the team owner's, while the owner's plan includes teams. */
export function workspaceFor(userId: number): { id: number; email: string; plan: string } | null {
  const row = db()
    .prepare("SELECT u.id, u.email, u.plan FROM team_members t JOIN users u ON u.id = t.owner_id WHERE t.user_id = ?")
    .get(userId) as { id: number; email: string; plan: string } | undefined;
  return row && entitlementsFor(row.plan).teamSeats > 0 ? row : null;
}

export interface TeamView {
  members: { userId: number; email: string; joinedAt: number }[];
  invites: { id: number; email: string; expiresAt: number }[];
  seats: number;
}

export function teamOf(ownerId: number, plan: string, now = Date.now()): TeamView {
  db().prepare("DELETE FROM team_invites WHERE expires_at < ?").run(now);
  const members = db()
    .prepare("SELECT t.user_id AS userId, u.email, t.created_at AS joinedAt FROM team_members t JOIN users u ON u.id = t.user_id WHERE t.owner_id = ? ORDER BY t.created_at")
    .all(ownerId) as { userId: number; email: string; joinedAt: number }[];
  const invites = db().prepare("SELECT id, email, expires_at AS expiresAt FROM team_invites WHERE owner_id = ? ORDER BY created_at").all(ownerId) as { id: number; email: string; expiresAt: number }[];
  return { members: members.map((m) => ({ ...m })), invites: invites.map((i) => ({ ...i })), seats: entitlementsFor(plan).teamSeats };
}

export type Result = { ok: true } | { ok: false; error: string; status: number };

/** Invites someone by email. Members and pending invitations together can't go over the plan's seats. */
export async function invite(owner: { id: number; email: string; plan: string }, email: string, now = Date.now()): Promise<Result> {
  const team = teamOf(owner.id, owner.plan, now);
  if (team.seats === 0) return { ok: false, error: "Teams are part of the Pro plan.", status: 403 };
  if (email === owner.email) return { ok: false, error: "That's your own address.", status: 400 };
  if (team.members.some((m) => m.email === email)) return { ok: false, error: "They're already in your team.", status: 409 };
  if (team.members.length + team.invites.filter((i) => i.email !== email).length >= team.seats) {
    return { ok: false, error: `Your plan has room for ${team.seats} people besides you. Remove someone to invite another.`, status: 409 };
  }
  const token = randomBytes(24).toString("base64url");
  db()
    .prepare(
      `INSERT INTO team_invites (owner_id, email, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(owner_id, email) DO UPDATE SET token_hash = excluded.token_hash, expires_at = excluded.expires_at, created_at = excluded.created_at`,
    )
    .run(owner.id, email, sha256(token), now + INVITE_DAYS * DAY, now);
  try {
    await sendMail({
      to: email,
      subject: `${owner.email} invited you to their Site Monitors account`,
      text:
        `${owner.email} has invited you to work in their Site Monitors account, where they watch their websites for outages ` +
        `and expiring certificates and domains.\n\n` +
        `To join, open this link and sign in (or create a login) with this email address:\n${appUrl()}/join?token=${token}\n\n` +
        `The invitation works for ${INVITE_DAYS} days. If you weren't expecting it, ignore this message.`,
    });
  } catch (err) {
    db().prepare("DELETE FROM team_invites WHERE owner_id = ? AND email = ?").run(owner.id, email);
    console.error("team invitation email failed", err);
    return { ok: false, error: "We couldn't send the invitation. Try again in a moment.", status: 502 };
  }
  return { ok: true };
}

/** What an invitation link is for, without accepting it. */
export function readInvite(token: string, now = Date.now()): { ownerEmail: string; email: string } | null {
  const row = db()
    .prepare("SELECT i.email, u.email AS ownerEmail FROM team_invites i JOIN users u ON u.id = i.owner_id WHERE i.token_hash = ? AND i.expires_at > ?")
    .get(sha256(token), now) as { email: string; ownerEmail: string } | undefined;
  return row ? { ownerEmail: row.ownerEmail, email: row.email } : null;
}

/** Accepts an invitation for the person signed in, who must be the address it was sent to. */
export function acceptInvite(token: string, user: { id: number; email: string }, now = Date.now()): Result {
  const row = db().prepare("SELECT * FROM team_invites WHERE token_hash = ? AND expires_at > ?").get(sha256(token), now) as
    | { id: number; owner_id: number; email: string }
    | undefined;
  if (!row) return { ok: false, error: "This invitation has expired or was withdrawn. Ask for a new one.", status: 410 };
  if (row.email !== user.email) return { ok: false, error: `This invitation is for ${row.email}. Sign in with that address to accept it.`, status: 403 };
  if (row.owner_id === user.id) return { ok: false, error: "That's your own account.", status: 400 };
  if (db().prepare("SELECT 1 FROM team_members WHERE user_id = ?").get(user.id)) return { ok: false, error: "You're already in a team. Leave it first.", status: 409 };
  if (db().prepare("SELECT 1 FROM team_members WHERE owner_id = ?").get(user.id)) {
    return { ok: false, error: "You have a team of your own, so you can't join another one.", status: 409 };
  }
  const owner = db().prepare("SELECT plan FROM users WHERE id = ?").get(row.owner_id) as { plan: string } | undefined;
  const seats = entitlementsFor(owner?.plan).teamSeats;
  const used = (db().prepare("SELECT COUNT(*) AS c FROM team_members WHERE owner_id = ?").get(row.owner_id) as { c: number }).c;
  if (used >= seats) return { ok: false, error: "That team is full.", status: 409 };
  db().prepare("INSERT INTO team_members (user_id, owner_id, created_at) VALUES (?, ?, ?)").run(user.id, row.owner_id, now);
  db().prepare("DELETE FROM team_invites WHERE id = ?").run(row.id);
  return { ok: true };
}

export function removeMember(ownerId: number, userId: number): boolean {
  return Number(db().prepare("DELETE FROM team_members WHERE owner_id = ? AND user_id = ?").run(ownerId, userId).changes) > 0;
}

export function withdrawInvite(ownerId: number, id: number): boolean {
  return Number(db().prepare("DELETE FROM team_invites WHERE owner_id = ? AND id = ?").run(ownerId, id).changes) > 0;
}

export function leaveTeam(userId: number): boolean {
  return Number(db().prepare("DELETE FROM team_members WHERE user_id = ?").run(userId).changes) > 0;
}
