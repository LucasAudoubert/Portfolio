import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The `three` chunk is ~640 kB minified (~161 kB gzipped) by design: it
    // bundles Three.js plus GLTFLoader and the meshopt decoder, is isolated,
    // cache-friendly and lazy-loaded, so the default warning is noise here.
    chunkSizeWarningLimit: 700,
    // Keep the heavy 3D/animation libraries in their own long-lived cache
    // chunks so app code changes don't invalidate them. (Rolldown API.)
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'anime', test: /node_modules[\\/]animejs[\\/]/ },
          ],
        },
      },
    },
  },
})
