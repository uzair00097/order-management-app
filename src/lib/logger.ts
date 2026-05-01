type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  route?: string;
  errorCode?: string;
  [key: string]: unknown;
}

function log(entry: LogEntry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, meta?: Omit<LogEntry, "level" | "message">) =>
    log({ level: "info", message, ...meta }),
  warn: (message: string, meta?: Omit<LogEntry, "level" | "message">) =>
    log({ level: "warn", message, ...meta }),
  error: (message: string, meta?: Omit<LogEntry, "level" | "message">) =>
    log({ level: "error", message, ...meta }),
};

export function generateRequestId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
