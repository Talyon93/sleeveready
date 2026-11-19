import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { staticSeoPaths } from './shared/seo-sets.ts';

const pages = Object.fromEntries(staticSeoPaths.map(path => [
  path.split('/').filter(Boolean).join('-'),
  resolve('.' + path, 'index.html'),
]));

// In development the stylesheets arrive with the scripts, so a page's first paint would be bare (a giant logo): the
// site's and the catalogue's styles are linked in every page's head while serving. Builds put the bundle's own there.
const devStyles: Plugin = {
  name: 'dev-styles',
  apply: 'serve',
  transformIndexHtml: () => [
    { tag: 'link', attrs: { rel: 'stylesheet', href: '/src/style.css' }, injectTo: 'head-prepend' },
    { tag: 'link', attrs: { rel: 'stylesheet', href: '/src/catalog-shell.css' }, injectTo: 'head-prepend' },
    { tag: 'link', attrs: { rel: 'stylesheet', href: '/src/ads.css' }, injectTo: 'head-prepend' },
  ],
};

export default defineConfig({
  plugins: [devStyles],
  server: { host: '127.0.0.1' },
  build: {
    outDir: 'dist',
    rollupOptions: { input: { main: resolve('index.html'), stats: resolve('dev/stats/index.html'), ...pages } },
  },
});
