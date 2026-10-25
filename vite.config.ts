import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createArgonVitePlugin } from './server/argon-proxy';
import { createPartyRoomVitePlugin } from './server/party-room';

const argonProxyPlugin = createArgonVitePlugin();
const partyRoomPlugin = createPartyRoomVitePlugin();

export default defineConfig({
  plugins: [react(), argonProxyPlugin, partyRoomPlugin],
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
