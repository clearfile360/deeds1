import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  // Start backend server in development mode only
  if (command === 'serve') {
    import('./backend/server.ts')
      .then(() => console.log('Backend server started successfully in Vite dev context'))
      .catch(err => console.error('Failed to auto-start backend server:', err));
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    }
  };
});
