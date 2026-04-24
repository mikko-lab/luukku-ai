type LogLevel = "info" | "error" | "warn";

function format(level: LogLevel, service: string, message: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${service}] ${message}`;
}

export function log(service: string, message: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(format("info", service, message), JSON.stringify(data, null, 2));
  } else {
    console.log(format("info", service, message));
  }
}

export function logWarn(service: string, message: string, data?: unknown): void {
  if (data !== undefined) {
    console.warn(format("warn", service, message), JSON.stringify(data, null, 2));
  } else {
    console.warn(format("warn", service, message));
  }
}

export function logError(service: string, message: string, err?: unknown): void {
  console.error(format("error", service, message));
  if (err instanceof Error) {
    console.error(`  → ${err.message}`);
    if (err.stack) console.error(err.stack);
  } else if (err !== undefined) {
    console.error("  →", err);
  }
}

export function logTiming(service: string, label: string, startMs: number): void {
  const elapsed = Date.now() - startMs;
  console.log(format("info", service, `${label} completed in ${elapsed}ms`));
}
