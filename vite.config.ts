import { defineConfig } from 'vite';

export default defineConfig({
  // public/ (textures, manifest) is served from the root URL by default.
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
