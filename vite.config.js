import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Plain (non-module) scripts and data the pages load by path. Vite leaves them out of dist/, so copy them in:
// Studio publishes dist/ as the beta site (GitHub Pages serves the repo root, where they already are).
const PLAIN_FILES = ['site/analytics.js', 'site/hawkes-release.js', 'releases.json'];
const copyPlainFiles = () => ({
  name: 'copy-plain-files',
  apply: 'build',
  closeBundle() {
    for (const file of PLAIN_FILES) {
      const out = resolve('dist', file);
      mkdirSync(dirname(out), { recursive: true });
      copyFileSync(resolve(file), out);
    }
  },
});

export default defineConfig({
  base: './',
  plugins: [copyPlainFiles()],
  appType: 'mpa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: [
        'index.html',
        'company.html',
        'products.html',
        'leadership.html',
        'contact.html',
        'newsroom.html',
        'investors.html',
        'compliance.html',
        'privacy.html',
        'terms.html',
        'whatsnew.html',
        'styleguide.html',
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
