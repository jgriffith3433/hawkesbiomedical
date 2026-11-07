import { defineConfig } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
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

// Fails the build when a page in dist/ links a local file that isn't there (a script, image, page or releases.json),
// so Studio's beta build never publishes a page with a 404 in it.
const checkDistLinks = () => ({
  name: 'check-dist-links',
  apply: 'build',
  enforce: 'post',
  closeBundle() {
    const missing = [];
    for (const page of readdirSync('dist').filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(resolve('dist', page), 'utf8');
      for (const [, ref] of html.matchAll(/(?:src|href)="([^"#?]+)/g)) {
        if (/^(?:[a-z]+:|\/\/)/i.test(ref)) continue;
        if (!existsSync(resolve('dist', ref))) missing.push(`${page} -> ${ref}`);
      }
    }
    for (const file of PLAIN_FILES) if (!existsSync(resolve('dist', file))) missing.push(`(plain file) ${file}`);
    if (missing.length) throw new Error(`dist/ links files that are not in it:\n${missing.join('\n')}`);
  },
});

export default defineConfig({
  base: './',
  plugins: [copyPlainFiles(), checkDistLinks()],
  appType: 'mpa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: [
        'index.html',
        'company.html',
        'products.html',
        'product-ph-origins.html',
        'research.html',
        'product-sick-of-it.html',
        'product-imagine-live-tv.html',
        'product-the-place-department.html',
        'product-yooba-land.html',
        'product-i-can-be.html',
        'product-dose-of-destruction.html',
        'product-hawkes-gen.html',
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
