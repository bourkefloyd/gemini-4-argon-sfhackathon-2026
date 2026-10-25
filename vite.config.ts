import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createArgonVitePlugin } from './server/argon-proxy';
import { createPartyRoomVitePlugin } from './server/party-room';

const argonProxyPlugin = createArgonVitePlugin();
const partyRoomPlugin = createPartyRoomVitePlugin();

export default defineConfig({
  plugins: [react(), argonProxyPlugin, partyRoomPlugin],
  build: {
    // Do not modulepreload the stage chunk. A phone opening ?party=1 downloads
    // the controller entry, the React vendor chunk, and CSS only.
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Keep the QR encoder with the stage chunk so the phone vendor
            // file stays React-only.
            if (id.includes('/qrcode/')) return undefined;
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
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
});
