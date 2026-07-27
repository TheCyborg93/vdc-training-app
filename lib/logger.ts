type LogContext = Record<string, unknown>;

function write(level: "info" | "warn" | "error" | "debug", message: string, context?: LogContext) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {}),
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }
  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }
  if (level === "debug") {
    if (process.env.NODE_ENV !== "production") console.debug(JSON.stringify(payload));
    return;
  }
  console.info(JSON.stringify(payload));
}

export const logger = {
  info(message: string, context?: LogContext) {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },
  error(message: string, error?: unknown, context?: LogContext) {
    write("error", message, {
      ...context,
      error: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
    });
  },
  debug(message: string, context?: LogContext) {
    write("debug", message, context);
  },
};
