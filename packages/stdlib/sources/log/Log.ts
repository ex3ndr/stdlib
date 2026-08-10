export type LogMethod = (...args: unknown[]) => void;

export interface Log {
    readonly trace: LogMethod;
    readonly debug: LogMethod;
    readonly info: LogMethod;
    readonly warn: LogMethod;
    readonly error: LogMethod;
    readonly fatal: LogMethod;
}
