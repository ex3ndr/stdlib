import type { Context } from "../../context/Context.js";
import type { ReadWriteLock } from "../readWriteLock.js";

interface ReadWriteLockSpanNames {
    readonly read: string;
    readonly write: string;
}

export function createReadWriteLock(spanNames: ReadWriteLockSpanNames): ReadWriteLock {
    let activeReaders = 0;
    let writerActive = false;
    const waitingReaders: Array<() => void> = [];
    const waitingWriters: Array<() => void> = [];

    return {
        async runInReadLock<Result>(
            ctx: Context,
            work: (ctx: Context) => Promise<Result>,
        ): Promise<Result> {
            await acquireRead(ctx);
            try {
                return await work(ctx);
            } finally {
                releaseRead();
            }
        },
        async runInWriteLock<Result>(
            ctx: Context,
            work: (ctx: Context) => Promise<Result>,
        ): Promise<Result> {
            await acquireWrite(ctx);
            try {
                return await work(ctx);
            } finally {
                releaseWrite();
            }
        },
    };

    async function acquireRead(ctx: Context): Promise<void> {
        if (!writerActive && waitingWriters.length === 0) {
            activeReaders += 1;
            return;
        }
        await ctx.span(
            spanNames.read,
            (ctx) =>
                new Promise<void>((resolve) => {
                    void ctx;
                    waitingReaders.push(resolve);
                }),
        );
    }

    function releaseRead(): void {
        activeReaders -= 1;
        if (activeReaders !== 0 || writerActive || waitingWriters.length === 0) return;
        writerActive = true;
        waitingWriters.shift()?.();
    }

    async function acquireWrite(ctx: Context): Promise<void> {
        if (!writerActive && activeReaders === 0) {
            writerActive = true;
            return;
        }
        await ctx.span(
            spanNames.write,
            (ctx) =>
                new Promise<void>((resolve) => {
                    void ctx;
                    waitingWriters.push(resolve);
                }),
        );
    }

    function releaseWrite(): void {
        writerActive = false;
        if (waitingWriters.length > 0) {
            writerActive = true;
            waitingWriters.shift()?.();
            return;
        }

        const readers = waitingReaders.splice(0);
        activeReaders += readers.length;
        for (const reader of readers) reader();
    }
}
