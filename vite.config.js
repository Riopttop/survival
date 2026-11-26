import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' keeps asset paths relative so the build also works inside Capacitor / Electron / Tauri.
// `npm run build:single` makes one self-contained HTML file (handy for sharing a playable preview).
export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: true },
  build: { chunkSizeWarningLimit: 2000, assetsInlineLimit: 8192 },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
}));
