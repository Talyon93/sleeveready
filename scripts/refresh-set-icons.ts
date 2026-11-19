import { writeFile } from 'node:fs/promises';

const stylesheetUrl =
  'https://www.cardtrader.com/assets/application-43dde630ab4745a197a89c38ccd07607063190daa6f979c117f1c448ee332372.css';
const games = [
  'mtg',
  'pok',
  'yug',
  'fab',
  'dig',
  'dbs',
  'van',
  'op',
  'lor',
  'swu',
  'ua',
  'rif',
  'gun',
  'sor',
  'pal',
  'cyb',
] as const;

const response = await fetch(stylesheetUrl);
if (!response.ok) throw new Error(`CardTrader stylesheet returned ${response.status}`);
const css = await response.text();
const glyphs: Record<string, string> = {};

for (const game of games)
{
  const pattern = new RegExp(
    `\\.ss-${game}\\.ss-([a-z0-9_-]+)(?:::before|::before)\\{content:'\\\\([a-f0-9]+)'\\}`,
    'g',
  );
  for (const match of css.matchAll(pattern))
  {
    if (match[1] === 'game-icon') continue;
    glyphs[`${game}:${match[1]}`] = String.fromCodePoint(Number.parseInt(match[2], 16));
  }
}

const source =
  `// Generated from CardTrader's public set-icon stylesheet. Run npm run refresh:set-icons to update.\nconst glyphs:Record<string,string>=${
    JSON.stringify(glyphs)
  };\nconst gamePrefixes:Record<string,string>={magic:'mtg',pokemon:'pok',yugioh:'yug',fab:'fab',digimon:'dig','dragon-ball':'dbs',vanguard:'van','one-piece':'op',lorcana:'lor','star-wars':'swu','union-arena':'ua',riftbound:'rif',gundam:'gun',sorcery:'sor',palworld:'pal',cyberpunk:'cyb'};\nexport function setIconGlyph(game:string,code:string|null|undefined){if(!code)return '';const normalized=code.trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-');return glyphs[(gamePrefixes[game] ?? game)+':'+normalized] ?? '';}\n`;
await writeFile(new URL('../src/lib/setIcons.ts', import.meta.url), source, 'utf8');
console.log(`Wrote ${Object.keys(glyphs).length} set symbols.`);
