import { currentUser, sameOrigin } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { BRAND, CONTACT_EMAIL, SUPPORT_EMAIL } from "@/lib/brand";
import { rateLimit } from "@/lib/rate-limit";

const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

/** Sends a question or concern from the signed-in person to our contact inbox: `{ subject, message }`. Replies go to their own address. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  let body: { subject?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const subject = typeof body.subject === "string" ? body.subject.replace(/\s+/g, " ").trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!subject || subject.length > 150) return Response.json({ error: "Enter a subject of up to 150 characters." }, { status: 400 });
  if (!message || message.length > 5000) return Response.json({ error: "Enter a message of up to 5,000 characters." }, { status: 400 });

  if (!rateLimit(`contact:${user.actor.id}`, MAX_PER_HOUR, HOUR_MS)) {
    return Response.json({ error: "You've sent a few messages already. Please wait a while before sending another." }, { status: 429 });
  }

  const email = user.actor.email;
  try {
    await sendMail({
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[${BRAND} contact] ${subject}`,
      text: `From: ${email}\nPlan: ${user.plan}\n\n${message}`,
    });
  } catch (error) {
    console.error("Contact message failed:", error);
    return Response.json({ error: `Couldn't send your message. Please try again, or email ${SUPPORT_EMAIL} directly.` }, { status: 502 });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
