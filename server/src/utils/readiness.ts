import mongoose from 'mongoose';

interface ReadinessDependencies {
  isConnected: () => boolean;
  ping: (options: { timeoutMS: number; signal: AbortSignal }) => Promise<unknown>;
  timeoutMs?: number;
  cacheMs?: number;
  now?: () => number;
}

// A bounded HTTP answer and a driver deadline serve different purposes: an unresponsive
// dependency must not hold the response open, or spawn another ping for every request.
export const createReadinessProbe = ({
  isConnected,
  ping,
  timeoutMs = 2000,
  cacheMs = 500,
  now = Date.now,
}: ReadinessDependencies) => {
  let inFlight: Promise<boolean> | null = null;
  let cached: { ready: boolean; at: number } | null = null;

  return async (): Promise<boolean> => {
    if (!isConnected()) return false;
    if (inFlight) return inFlight;
    if (cached && now() - cached.at < cacheMs) return cached.ready;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = Promise.resolve().then(() =>
      ping({ timeoutMS: timeoutMs, signal: controller.signal }),
    );
    const deadline = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(false);
      }, timeoutMs);
    });
    inFlight = Promise.race([
      operation.then(
        () => true,
        () => false,
      ),
      deadline,
    ])
      .then((ready) => {
        cached = { ready, at: now() };
        return ready;
      })
      .finally(() => clearTimeout(timer));

    // Keep the single-flight guard even after the HTTP deadline until the driver settles.
    // A driver that ignores cancellation therefore cannot accumulate hanging probes.
    const release = () => {
      inFlight = null;
    };
    void operation.then(release, release);
    return inFlight;
  };
};

export const checkReadiness = createReadinessProbe({
  isConnected: () => mongoose.connection.readyState === 1 && Boolean(mongoose.connection.db),
  ping: async (options) => {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database unavailable');
    return db.command({ ping: 1 }, options);
  },
});
