type Level = 'info' | 'warn' | 'error' | 'critical';

interface LogEntry {
  level: Level;
  module: string;
  message: string;
  correlationId?: string;
  requestId?: string;
  timestamp: string;
  error?: { message: string; stack?: string };
  meta?: Record<string, unknown>;
}

interface LogOptions {
  correlationId?: string;
  requestId?: string;
  error?: unknown;
  meta?: Record<string, unknown>;
}

function buildEntry(level: Level, module: string, message: string, opts?: LogOptions): LogEntry {
  const entry: LogEntry = { level, module, message, timestamp: new Date().toISOString() };
  if (opts?.correlationId) entry.correlationId = opts.correlationId;
  if (opts?.requestId) entry.requestId = opts.requestId;
  if (opts?.error) {
    const e = opts.error instanceof Error ? opts.error : new Error(String(opts.error));
    entry.error = { message: e.message, ...(e.stack ? { stack: e.stack } : {}) };
  }
  if (opts?.meta) entry.meta = opts.meta;
  return entry;
}

function emit(entry: LogEntry) {
  const json = JSON.stringify(entry);
  if (entry.level === 'info') console.log(json);
  else if (entry.level === 'warn') console.warn(json);
  else console.error(json);
}

export function createLogger(module: string) {
  return {
    info:     (msg: string, opts?: LogOptions) => emit(buildEntry('info', module, msg, opts)),
    warn:     (msg: string, opts?: LogOptions) => emit(buildEntry('warn', module, msg, opts)),
    error:    (msg: string, opts?: LogOptions) => emit(buildEntry('error', module, msg, opts)),
    critical: (msg: string, opts?: LogOptions) => emit(buildEntry('critical', module, msg, opts)),
  };
}

export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
