import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createArgonVitePlugin } from './server/argon-proxy';
import { createPartyRoomVitePlugin } from './server/party-room';

const argonProxyPlugin = createArgonVitePlugin();
const partyRoomPlugin = createPartyRoomVitePlugin();

export default defineConfig({
  plugins: [react(), argonProxyPlugin, partyRoomPlugin],
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
          if (id.includes('/src/argon/') || id.includes('/src/audio/')) {
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
    allowedHosts: ['localhost', '127.0.0.1', '.trycloudflare.com'],
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', '.trycloudflare.com'],
  },
});
