import { defineConfig } from 'vite';

export default defineConfig({
  // public/ (textures, manifest) is served from the root URL by default.
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      // Multipage (paths relative to the project root): index.html = the
      // Phase 2 app (menu → gameplay), viewer.html = the preserved Phase 1
      // material viewer.
      input: {
        index: 'index.html',
        viewer: 'viewer.html',
      },
    },
  },
});
