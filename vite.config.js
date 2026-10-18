import { defineConfig } from 'vite';

/**
 * Vite configuration.
 * - `base: './'` makes every asset URL relative so the built bundle loads from
 *   the file:// / capacitor:// scheme inside native WebViews.
 * - Phaser is split into its own chunk so game-code updates stay small.
 */
export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/@supabase')) return 'supabase';
          return undefined;
        }
      }
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
});
