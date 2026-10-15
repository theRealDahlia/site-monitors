import { runChecks } from "./monitor-runner";
import { dueMonitors, pruneHistory } from "./monitors-db";

const TICK_MS = Number(process.env.MONITOR_TICK_MS) || 30_000;
const BATCH = 40;
const CONCURRENCY = 4;
const KEEP_HISTORY_MS = 35 * 24 * 60 * 60 * 1000;

interface SchedulerGlobals {
  __monitorScheduler?: NodeJS.Timeout;
  __monitorRunning?: boolean;
  __monitorLastPrune?: number;
}
const g = globalThis as unknown as SchedulerGlobals;

async function tick() {
  if (g.__monitorRunning) return; // the previous round is still going
  g.__monitorRunning = true;
  try {
    const now = Date.now();
    const due = dueMonitors(now, BATCH);

    let next = 0;
    const worker = async () => {
      while (next < due.length) {
        const m = due[next++];
        try {
          await runChecks(m.id, "due");
        } catch (err) {
          console.error(`monitor ${m.id} (${m.host}) failed`, err);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, due.length) }, worker));

    if (now - (g.__monitorLastPrune ?? 0) > 60 * 60 * 1000) {
      pruneHistory(now - KEEP_HISTORY_MS);
      g.__monitorLastPrune = now;
    }
  } catch (err) {
    console.error("monitor scheduler tick failed", err);
  } finally {
    g.__monitorRunning = false;
  }
}

/** Starts the background loop that runs due checks. Safe to call more than once. */
export function startScheduler(): void {
  if (g.__monitorScheduler) return;
  g.__monitorScheduler = setInterval(tick, TICK_MS);
  g.__monitorScheduler.unref?.();
  setTimeout(tick, 5_000).unref?.(); // pick up anything that came due while the server was off
  console.log(`[monitors] scheduler started (every ${TICK_MS / 1000}s)`);
}

