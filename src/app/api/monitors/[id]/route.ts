import { currentUser, sameOrigin } from "@/lib/auth";
import { CheckError, parseHostname } from "@/lib/hostname";
import { ALL_CHECKS, runChecks } from "@/lib/monitor-runner";
import { sendEditNotice, sendRemovalNotice } from "@/lib/watch-email";
import { monitorView } from "@/lib/monitor-view";
import { type MonitorRow, deleteMonitor, getMonitor, retargetMonitor } from "@/lib/monitors-db";
import { rateLimit } from "@/lib/rate-limit";
import { resolvePublicAddress } from "@/lib/ssl-check";

/** Edit a watched site: point the monitor at a different hostname and re-run all of its checks. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/monitors/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!rateLimit(`monitor-edit:${user.id}`, 20, 60 * 60 * 1000)) {
    return Response.json({ error: "You're editing sites too quickly. Try again later." }, { status: 429 });
  }

  const id = Number((await ctx.params).id);
  const monitor = Number.isInteger(id) ? getMonitor(id, user.id) : undefined;
  if (!monitor) return Response.json({ error: "Monitor not found." }, { status: 404 });

  let body: { host?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const host = parseHostname(typeof body.host === "string" ? body.host : "", { ignorePort: true });
    if (host === monitor.host) return Response.json({ monitor: monitorView(monitor), changed: false });
    await resolvePublicAddress(host); // catches typos and private addresses before anything is changed

    const result = retargetMonitor(id, user.id, host, Date.now());
    if (result === "duplicate") return Response.json({ error: `You're already watching ${host}.` }, { status: 409 });
    if (result === "missing") return Response.json({ error: "Monitor not found." }, { status: 404 });

    // Fresh uptime, SSL and domain checks for the new site, so nothing from the old one lingers.
    // The "updated" email goes out from inside the run, once the results are in but before any alert
    // they raise, so it reads in a sensible order. If the scheduler happens to be mid-check on this
    // monitor, wait for it to finish and try again.
    let notified = false;
    const notify = async (row: MonitorRow) => {
      notified = true;
      await sendEditNotice({ monitor: row, oldHost: monitor.host, email: user.email });
    };
    for (let attempt = 0; attempt < 4; attempt++) {
      if (await runChecks(id, ALL_CHECKS, { afterChecks: notify })) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    // If the checks still couldn't run, report what we know so the user isn't left without a message.
    if (!notified) await notify(getMonitor(id, user.id)!);
    return Response.json({ monitor: monitorView(getMonitor(id, user.id)!), changed: true });
  } catch (err) {
    if (err instanceof CheckError) return Response.json({ error: err.message }, { status: err.httpStatus });
    console.error("edit monitor failed", err);
    return Response.json({ error: "Something went wrong editing that site." }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/monitors/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const id = Number((await ctx.params).id);
  // Read it first: once it's deleted there's nothing left to describe in the email.
  const monitor = Number.isInteger(id) ? getMonitor(id, user.id) : undefined;
  if (!monitor || !deleteMonitor(id, user.id)) {
    return Response.json({ error: "Monitor not found." }, { status: 404 });
  }

  // The site is already gone, so nothing about the email can undo or block the removal.
  const emailed = await sendRemovalNotice({ monitor, email: user.email });
  return Response.json({ ok: true, emailed });
}
