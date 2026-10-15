import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends through Resend when RESEND_API_KEY and MAIL_FROM are set (https://resend.com).
 * Without them, development prints the email to the server console and data/outbox.log so you
 * can click the link yourself. Production refuses to pretend: it throws, and callers tell the user.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (key && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: mail.to, subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Email provider returned HTTP ${res.status}`);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Email isn't configured: set RESEND_API_KEY and MAIL_FROM.");
  }

  const block = `\n---- email (not sent: no RESEND_API_KEY) ----\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n----\n`;
  console.log(block);
  const file = path.join(process.cwd(), "data", "outbox.log");
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, block);
}
