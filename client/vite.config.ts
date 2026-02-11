import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [
      react(),
      ({
        name: 'copy-svg-assets',
        writeBundle() {
          // Ensure assets directory exists in dist
          const assetsDir = path.resolve(__dirname, 'dist/assets');
          if (!existsSync(assetsDir)) {
            mkdirSync(assetsDir, { recursive: true });
          }

          // Copy SVG files to dist/assets
          try {
            copyFileSync(
              path.resolve(__dirname, 'assets/green-candy.svg'),
              path.resolve(__dirname, 'dist/assets/green-candy.svg')
            );
            copyFileSync(
              path.resolve(__dirname, 'assets/red-candy.svg'),
              path.resolve(__dirname, 'dist/assets/red-candy.svg')
            );
            console.log('✓ SVG assets copied to dist/assets');
          } catch (error) {
            console.warn('Warning: Could not copy SVG assets:', error.message);
          }
        }
      } as any),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Tauri expects a fixed port, fail if that port is not available
    server: {
      port: 5173,
      strictPort: true,
      host: '0.0.0.0', // listen on all addresses for mobile
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5183,
      },
    },
    // Env variables starting with the item of `envPrefix` will be exposed in tauri's source code through `import.meta.env`.
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      // Tauri uses Chromium on Windows and WebKit on macOS and Linux
      target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
      // don't minify for debug builds
      minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
      // produce sourcemaps for debug builds
      sourcemap: !!process.env.TAURI_DEBUG,
      rollupOptions: {
        external: [],
      },
    },
  };
});
