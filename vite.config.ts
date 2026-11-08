import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/inpe-dados": {
        target: "https://dataserver-coids.inpe.br",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/inpe-dados/, ""),
      },
    },
  },
});
