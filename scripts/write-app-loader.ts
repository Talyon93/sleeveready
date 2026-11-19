// Server-rendered pages (card pages) cannot know the hashed bundle names, so the build writes stable copies:
// /app.css, linked from their <head> so the first paint is already styled, and /app-loader.js, which imports
// the entry chunk Vite produced for the static pages.
import { copyFile, readFile, writeFile } from 'node:fs/promises';

const html = await readFile(new URL('../dist/en/index.html', import.meta.url), 'utf8');
// Shared chunks (the Supabase client, also used by /dev/stats/) can appear as extra module scripts; the entry is main-*.
const scripts = [...html.matchAll(/<script type="module"[^>]*src="(\/assets\/[^"]+\.js)"/g)].map(match => match[1]);
const script = scripts.find(src => /^\/assets\/main-/.test(src)) ?? scripts.at(-1);
const styles = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"/g)].map(match => match[1]);
if (!script) throw new Error('Entry script not found in dist/en/index.html');
if (styles.length !== 1) throw new Error(`Expected one stylesheet in dist/en/index.html, found ${styles.length}`);
await copyFile(new URL(`../dist/${styles[0]}`, import.meta.url), new URL('../dist/app.css', import.meta.url));
await writeFile(new URL('../dist/app-loader.js', import.meta.url), `import(${JSON.stringify(script)});\n`, 'utf8');
console.log(`Wrote dist/app.css and dist/app-loader.js for ${script}`);

// The app shell for card pages the build did not write (older expansions): the app builds the page from the address.
// It carries no address, description or home-page text of its own: the app fills them in once the card is known.
const shell = html
  .replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical" href=""/>')
  // Empty, so the app writes the card's own description instead of keeping the home page's.
  .replace(/<meta name="description"[^>]*>/, '<meta name="description" content=""/>')
  .replace(/\s*<link rel="alternate" hreflang[^>]*>/g, '')
  .replace(/<meta property="og:url"[^>]*>/, '<meta property="og:url" content=""/>')
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
  .replace(/<div id="root">[\s\S]*?<\/div>\s*<\/body>/, '<div id="root"></div></body>');
if (shell === html || !shell.includes('<div id="root"></div>'))
{
  throw new Error('Card shell: dist/en/index.html changed shape');
}
await writeFile(new URL('../dist/card-shell.html', import.meta.url), shell, 'utf8');
console.log('Wrote dist/card-shell.html');
