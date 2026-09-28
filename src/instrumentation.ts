/** Starts the job worker inside the Next.js server when OPENLAB_INPROCESS_WORKER=true (dev / single-box installs). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.OPENLAB_INPROCESS_WORKER === "true") {
    const { startWorker } = await import("./lib/worker");
    startWorker();
  }
}
