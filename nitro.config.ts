import { defineConfig } from "nitro";

export default defineConfig({
  vercel: {
    functions: {
      runtime: "nodejs22.x",
    },
  },
});
