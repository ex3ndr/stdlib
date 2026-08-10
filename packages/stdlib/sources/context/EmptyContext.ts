import type { Context } from "./Context.js";
import { ContextImpl } from "./impl/ContextImpl.js";

export const EmptyContext: Context = new ContextImpl({});
