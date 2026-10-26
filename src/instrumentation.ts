import type { Instrumentation } from "next";

// Runs once when the server starts. It starts the loop that checks every monitor on schedule, and has errors reported.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();

  const { watchForCrashes } = await import("./instrumentation-node");
  watchForCrashes();
}

/** Called by Next for every error thrown while handling a request. */
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("./lib/error-alerts");
  await reportError(err, { source: "server", where: `${request.method} ${request.path.split("?")[0]}` });
};
