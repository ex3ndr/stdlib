import { defineConfig } from "vite";

export default defineConfig({
    build: {
        lib: {
            entry: "sources/index.ts",
            formats: ["es"],
            fileName: "index",
        },
        sourcemap: true,
    },
});
