export interface TraceSpan {
    end(): void;
    recordException?(error: unknown): void;
}

export interface Tracer {
    startSpan(name: string, parent: TraceSpan | undefined): TraceSpan;
}
