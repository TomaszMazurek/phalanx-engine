import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so dist/ works under ANY subpath (static hosting without a
  // dedicated domain) — see docs/phase-2-core.md, uwaga #10.
  base: './',
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
      // material viewer, game1.html = the Game 1 arena defense build.
      input: {
        index: 'index.html',
        viewer: 'viewer.html',
        game1: 'game1.html',
      },
    },
  },
});
