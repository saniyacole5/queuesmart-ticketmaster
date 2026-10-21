export const DATA_CHANGED_EVENT = "queuesmart-data-changed";

export function startAutoRefresh(
  refresh,
  { interval = 3000, listenForChanges = true } = {},
) {
  let stopped = false;
  let running = false;
  let refreshAgain = false;
  let timer;

  async function run() {
    if (stopped) return;

    if (running) {
      refreshAgain = true;
      return;
    }

    clearTimeout(timer);
    running = true;

    try {
      await refresh();
    } catch {
      // Providers expose refresh failures through their own UI state.
    } finally {
      running = false;

      if (!stopped) {
        timer = setTimeout(run, refreshAgain ? 0 : interval);
        refreshAgain = false;
      }
    }
  }

  function handleVisibility() {
    if (document.visibilityState === "visible") {
      void run();
    }
  }

  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", handleVisibility);

  if (listenForChanges) {
    window.addEventListener(DATA_CHANGED_EVENT, run);
  }

  void run();

  return function stop() {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener("focus", run);
    document.removeEventListener("visibilitychange", handleVisibility);

    if (listenForChanges) {
      window.removeEventListener(DATA_CHANGED_EVENT, run);
    }
  };
}