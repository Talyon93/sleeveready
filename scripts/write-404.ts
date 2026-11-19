// Writes public/404.html from shared/error-page.ts. Run after changing the error page; a test checks the file is current.
import { writeFileSync } from 'node:fs';
import { notFoundPage } from '../shared/error-page.ts';

writeFileSync(new URL('../public/404.html', import.meta.url), notFoundPage());
console.log('Wrote public/404.html');
