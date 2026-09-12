import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite builds the app and, during development, serves it from inside the API
 * server (server/src/dev.ts) — so there is no separate dev or preview server to
 * configure here and no proxy: the app and /api always share one address.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    // The database and the server's own code live under the project too, and
    // neither is part of the app, so neither should make the page reload.
    watch: { ignored: ['**/.data/**', '**/server/**', '**/dist-server/**'] },
  },
  // One bundle on purpose — pdf-lib and the font tooling are most of it, and the
  // sheet preview needs them the moment a collection opens.
  build: { chunkSizeWarningLimit: 1600 },
});
