import { reportError } from "./lib/error-alerts";

// The parts of start-up that only run on the Node server (see instrumentation.ts).
export function watchForCrashes() {
  // A crash the app can't recover from. This only watches: the process still stops (and the service manager restarts
  // it) exactly as it did before.
  process.on("uncaughtExceptionMonitor", (err) => {
    void reportError(err, { source: "crash" });
  });
}
