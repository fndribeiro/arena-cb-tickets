export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

type Level = "info" | "warn" | "error";

/** Structured JSON logger writing to stdout (12-factor XI); Workers Observability collects it. */
export function createLogger(baseFields: LogFields = {}): Logger {

  const write = (level: Level, message: string, fields: LogFields = {}): void => {

    const entry: string = JSON.stringify({ level, message, time: new Date().toISOString(), ...baseFields, ...fields });

    console[level === "info" ? "log" : level](entry);
  };

  return {
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
    child: (fields) => createLogger({ ...baseFields, ...fields }),
  };
}

export function describeError(error: unknown): LogFields {

  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack };
  }

  return { errorMessage: String(error) };
}
