type ShutdownPhase = "http" | "database" | "timeout";

interface ShutdownDependencies {
  closeHttp: () => Promise<void>;
  disconnectDatabase: () => Promise<void>;
  exit: (code: number) => void;
  log?: (message: string) => void;
  onFailure?: (phase: ShutdownPhase) => void;
  timeoutMs?: number;
}

export function createShutdownHandler({
  closeHttp,
  disconnectDatabase,
  exit,
  log = () => undefined,
  onFailure = () => undefined,
  timeoutMs = 10_000,
}: ShutdownDependencies): (signal: string) => Promise<void> {
  let shutdownPromise: Promise<void> | undefined;

  return (signal) => {
    if (shutdownPromise) return shutdownPromise;

    log(`Received ${signal}; shutting down gracefully.`);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      onFailure("timeout");
      exit(1);
    }, timeoutMs).unref();

    shutdownPromise = (async () => {
      let exitCode = 0;
      try {
        await closeHttp();
      } catch {
        exitCode = 1;
        onFailure("http");
      }

      try {
        await disconnectDatabase();
      } catch {
        exitCode = 1;
        onFailure("database");
      }

      clearTimeout(timeout);
      if (!timedOut) exit(exitCode);
    })();

    return shutdownPromise;
  };
}
