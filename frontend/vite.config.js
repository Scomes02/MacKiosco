import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, Vite sirve la interfaz en http://localhost:5173 y reenvía
// los pedidos a /api hacia el backend (por defecto http://localhost:3001).
const backend = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
