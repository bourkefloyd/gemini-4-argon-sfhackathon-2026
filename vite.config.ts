import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createArgonVitePlugin } from './server/argon-proxy';
import { createPartyRoomVitePlugin } from './server/party-room';

export default defineConfig({
  plugins: [react(), createArgonVitePlugin(), createPartyRoomVitePlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('/src/courses/') || id.includes('/src/sdf/') || id.includes('/src/security/')) {
            return 'sdf-courses';
          }
          if (
            id.includes('/src/argon/') ||
            id.includes('/src/multiplayer/') ||
            id.includes('/src/audio/')
          ) {
            return 'systems';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
});
