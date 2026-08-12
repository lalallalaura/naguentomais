import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // O Spotify exige 127.0.0.1 (IPv4) explícito no Redirect URI.
    // Forçamos o Vite a escutar nesse endereço para evitar que ele
    // suba apenas em ::1 (IPv6) e cause ERR_CONNECTION_REFUSED.
    host: "127.0.0.1",
    port: 5173,
  },
});