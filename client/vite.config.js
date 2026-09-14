import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['external-molar-player.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://host.docker.internal:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://host.docker.internal:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
