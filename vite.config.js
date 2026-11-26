import { defineConfig } from 'vite';

// base './' keeps asset paths relative so the build also works inside Capacitor / Electron / Tauri.
export default defineConfig({
  base: './',
  server: { host: true },
  build: { chunkSizeWarningLimit: 2000 },
});
