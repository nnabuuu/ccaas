/**
 * Logger port. The materializer logs progress + warnings via this
 * shape; consumers pass a bridge to whatever logging library they use
 * (NestJS Logger, pino, console, etc.).
 *
 * Defaults to `noopLogger` so users who don't care about log output
 * don't have to construct anything.
 */
export interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export const noopLogger: Logger = {
  log() {},
  warn() {},
  error() {},
  debug() {},
};
