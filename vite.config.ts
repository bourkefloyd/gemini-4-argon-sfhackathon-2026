import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createArgonVitePlugin } from './server/argon-proxy';

export default defineConfig({
  plugins: [react(), createArgonVitePlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
});
