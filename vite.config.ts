import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createArgonVitePlugin } from './server/argon-proxy';
import { createPartyRoomVitePlugin } from './server/party-room';

export default defineConfig({
  plugins: [react(), createArgonVitePlugin(), createPartyRoomVitePlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
});
