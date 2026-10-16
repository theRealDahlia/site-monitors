import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { secret } from "./secret";

// Encrypts small secrets (like webhook URLs) before they go in the database, so a leaked copy of the
// database file alone can't be used to post to someone's Slack. The key is derived from SESSION_SECRET,
// which lives only in the server's environment, never in the database.

const key = () => Buffer.from(hkdfSync("sha256", secret(), "site-monitors", "secret-box-v1", 32));

/** Returns "iv.tag.ciphertext", each part base64url. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

/** Throws if the value was tampered with or sealed under a different SESSION_SECRET. */
export function open(sealed: string): string {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !data) throw new Error("Malformed sealed value.");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
