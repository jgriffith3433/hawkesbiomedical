import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  appType: 'mpa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: [
        'index.html',
        'company.html',
        'leadership.html',
        'category.html',
        'contact.html',
        '404.html',
      ],
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
  },
});
