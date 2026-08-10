export type LogContext = Readonly<Record<string, unknown>>;

export type LoggerMethod = (context: LogContext, ...args: unknown[]) => void;

export interface Logger {
    readonly trace: LoggerMethod;
    readonly debug: LoggerMethod;
    readonly info: LoggerMethod;
    readonly warn: LoggerMethod;
    readonly error: LoggerMethod;
    readonly fatal: LoggerMethod;
}
