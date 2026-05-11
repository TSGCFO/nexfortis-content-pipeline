import pino from 'pino';
import * as Sentry from '@sentry/node';

export type LogContext = Record<string, unknown>;

export interface Logger {
  trace(message: string): void;
  trace(context: LogContext, message: string): void;
  debug(message: string): void;
  debug(context: LogContext, message: string): void;
  info(message: string): void;
  info(context: LogContext, message: string): void;
  warn(message: string): void;
  warn(context: LogContext, message: string): void;
  error(message: string): void;
  error(context: LogContext, message: string): void;
  fatal(message: string): void;
  fatal(context: LogContext, message: string): void;
}

export interface CreateLoggerOptions {
  source: string;
}

const sentryDsn = process.env['SENTRY_DSN'];
if (sentryDsn) {
  try {
    Sentry.init({
      dsn: sentryDsn,
      tracesSampleRate: 0,
    });
  } catch (err) {
    console.warn('lib/logger: Sentry init failed; continuing without Sentry', err);
  }
}

const rootLogger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export function createLogger(opts: CreateLoggerOptions): Logger {
  const child = rootLogger.child({ source: opts.source });

  const wrap =
    (level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') =>
    (a: string | LogContext, b?: string): void => {
      if (typeof a === 'string') {
        child[level](a);
        return;
      }
      child[level](a, b ?? '');
    };

  return {
    trace: wrap('trace'),
    debug: wrap('debug'),
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error'),
    fatal: wrap('fatal'),
  };
}
