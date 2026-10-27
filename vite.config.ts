import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const SERVER_PORT = 5178;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // changeOrigin rewrites Host to the API server's own address, which the guard expects.
      '/api': { target: `http://127.0.0.1:${SERVER_PORT}`, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // A local app loaded once from disk: one bundle of about 500 KB is fine.
    chunkSizeWarningLimit: 800,
    // Fonts stay files: the CSP allows `font-src 'self'` only, so a small font subset inlined as a
    // data: URI would be blocked. Other assets keep Vite's default inlining.
    assetsInlineLimit: (filePath) => (/\.(woff2?|ttf|otf)$/i.test(filePath) ? false : undefined),
  },
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
