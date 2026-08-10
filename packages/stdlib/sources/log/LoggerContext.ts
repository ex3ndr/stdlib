import type { Context } from "../context/Context.js";
import type { Logger } from "./Logger.js";
import { ContextLog } from "./impl/ContextLog.js";

export const logger = Object.freeze({
    get(ctx: Context): Logger | undefined {
        return ContextLog.get(ctx).logger;
    },
});
