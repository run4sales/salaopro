/** Acquire synchronously, before any awaited validation or write. */
export function createSingleFlight() {
  let running = false;
  return {
    async run(action: () => Promise<void>): Promise<boolean> {
      if (running) return false;
      running = true;
      try {
        await action();
        return true;
      } finally {
        running = false;
      }
    },
  };
}