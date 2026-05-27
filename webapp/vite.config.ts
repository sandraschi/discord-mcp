import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    allowedHosts: ['goliath'],
    port: 10757,
    strictPort: true,
    host: true,
    proxy: {
      "/api": { target: "http://localhost:10756", changeOrigin: true },
    },
  },
});
