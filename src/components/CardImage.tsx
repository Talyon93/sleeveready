import { useEffect, useState } from 'react';
import type { CardDetails, CatalogCard } from '../../shared/model';
import { safeImageUrl, imageResolution, thumbnailUrl } from '../../shared/images';
import type { Language } from '../lib/i18n';

const copy = {
  en: {
    resolution: 'Actual resolution at the 63 × 88 mm print size',
    low: 'below 300 dpi',
    demo: 'Demo card',
    demoNoArt: 'Demo card without artwork',
    missing: 'Image not available',
  },
  it: {
    resolution: 'Risoluzione effettiva alla dimensione di stampa 63 × 88 mm',
    low: 'sotto 300 dpi',
    demo: 'Carta dimostrativa',
    demoNoArt: 'Carta dimostrativa senza artwork',
    missing: 'Immagine non disponibile',
  },
  de: {
    resolution: 'Tatsächliche Auflösung bei 63 × 88 mm Druckgröße',
    low: 'unter 300 dpi',
    demo: 'Demokarte',
    demoNoArt: 'Demokarte ohne Artwork',
    missing: 'Bild nicht verfügbar',
  },
  fr: {
    resolution: 'Résolution réelle au format d’impression 63 × 88 mm',
    low: 'moins de 300 dpi',
    demo: 'Carte de démonstration',
    demoNoArt: 'Carte de démonstration sans illustration',
    missing: 'Image indisponible',
  },
  es: {
    resolution: 'Resolución real al tamaño de impresión de 63 × 88 mm',
    low: 'menos de 300 dpi',
    demo: 'Carta de demostración',
    demoNoArt: 'Carta de demostración sin ilustración',
    missing: 'Imagen no disponible',
  },
  pt: {
    resolution: 'Resolução real no tamanho de impressão 63 × 88 mm',
    low: 'abaixo de 300 dpi',
    demo: 'Carta de demonstração',
    demoNoArt: 'Carta de demonstração sem ilustração',
    missing: 'Imagem indisponível',
  },
  nl: {
    resolution: 'Werkelijke resolutie op afdrukformaat 63 × 88 mm',
    low: 'onder 300 dpi',
    demo: 'Demokaart',
    demoNoArt: 'Demokaart zonder artwork',
    missing: 'Afbeelding niet beschikbaar',
  },
  pl: {
    resolution: 'Rzeczywista rozdzielczość przy wydruku 63 × 88 mm',
    low: 'poniżej 300 dpi',
    demo: 'Karta demonstracyjna',
    demoNoArt: 'Karta demonstracyjna bez grafiki',
    missing: 'Obraz niedostępny',
  },
} satisfies Record<Language, Record<string, string>>;

type Props = {
  card: CatalogCard;
  mode: string;
  eager?: boolean;
  language?: Language;
  // Print sheet: resolution as a small corner dot (the dialog sums it up), and a text proxy when no image loads.
  print?: { onResolution?: (dpi: number) => void; onMissing?: () => void; details?: CardDetails | null };
  // Grids and lists: a lighter image where the source has one (never on the card page or the print sheet).
  thumb?: boolean;
};

// Netlify's image CDN only answers on the deployed site (and its previews), not on the local dev server.
const netlifyImages = typeof location !== 'undefined'
  && /(^|\.)sleeveready\.com$|\.netlify\.app$/.test(location.hostname);

export function CardImage({ card, mode, eager = false, language = 'en', print, thumb = false }: Props)
{
  const text = copy[language];
  const full = [
    ...new Set(
      [...(card.imageUrls ?? []), card.imageUrl].map(safeImageUrl).filter((url): url is string => url !== null),
    ),
  ];
  // Grids ask for a lighter image first and fall back to the full one if it fails.
  const sources = thumb
    ? [
      ...new Set([
        ...full.map(url => thumbnailUrl(url, netlifyImages)).filter((url): url is string => url !== null),
        ...full,
      ]),
    ]
    : full;
  const [index, setIndex] = useState(0);
  const [resolution, setResolution] = useState<ReturnType<typeof imageResolution>>();
  const [landscape, setLandscape] = useState(false);
  const sourceKey = sources.join('|');
  useEffect(() =>
  {
    setIndex(0);
    setResolution(undefined);
    setLandscape(false);
  }, [sourceKey]);
  const url = sources[index];
  const onMissing = print?.onMissing;
  useEffect(() =>
  {
    if (!url) onMissing?.();
  }, [url, onMissing]);
  // Horizontal cards (Sorcery sites, SWU bases, battlefields…) are rotated into the 63 × 88 mm print slot, so measure them rotated too.
  const loaded = (width: number, height: number) =>
  {
    const wide = width > height;
    setLandscape(wide);
    const measured = wide ? imageResolution(height, width) : imageResolution(width, height);
    setResolution(measured);
    print?.onResolution?.(measured.dpi);
  };
  const quality = resolution
    && (print
      ? (
        <span
          className={'image-dot ' + (resolution.dpi < 300 ? 'limited' : '')}
          title={`${text.resolution}: ${resolution.width} × ${resolution.height} px · ${resolution.dpi} dpi`}
          aria-hidden="true"
        />
      )
      : eager && (
        <span className={'image-quality ' + (resolution.dpi < 300 ? 'limited' : '')} title={text.resolution}>
          {resolution.width} × {resolution.height} px · {resolution.dpi}{' '}
          dpi{resolution.dpi < 300 ? ' · ' + text.low : ''}
        </span>
      ));
  if (url)
  {
    return (
      <>
        <img
          src={url}
          alt={card.name}
          className={landscape ? 'is-landscape' : undefined}
          loading={eager ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          onLoad={e => loaded(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
          onError={() =>
          {
            setResolution(undefined);
            setLandscape(false);
            setIndex(n => n + 1);
          }}
        />
        {quality}
      </>
    );
  }
  if (print) return <TextProxy card={card} details={print.details} />;
  return (
    <div
      className={'card-placeholder tone-' + card.id % 5}
      role="img"
      aria-label={mode === 'demo' ? text.demoNoArt : text.missing}
    >
      <span>{mode === 'demo' ? 'PLAYTEST / DEMO' : 'PLAYTEST'}</span>
      <div className="placeholder-mark">✦</div>
      <strong>{card.name}</strong>
      <small>{mode === 'demo' ? text.demo : text.missing}</small>
    </div>
  );
}

// A printable stand-in at card size: name, type and cost, then the rules text, as far as the catalogue knows them.
// The cost as pips at the top right, as on the card: Magic's {2}{U}{U} one pip per symbol, other games' plain costs in one pip.
const pipColours: Record<string, string> = { W: 'w', U: 'u', B: 'b', R: 'r', G: 'g' };
function CostPips({ cost }: { cost: string })
{
  const symbols = cost.match(/\{[^}]+\}/g)?.map(symbol => symbol.slice(1, -1)) ?? [cost.trim()];
  return (
    <span className="text-proxy-cost" aria-label={cost}>
      {symbols.map((symbol, index) => (
        <i
          key={index}
          className={'pip pip-' + (pipColours[symbol] ?? (/^[WUBRG]\//.test(symbol) ? 'hybrid' : 'generic'))}
        >
          {symbol}
        </i>
      ))}
    </span>
  );
}

function TextProxy({ card, details }: { card: CatalogCard; details?: CardDetails | null })
{
  const stats = [details?.hp && `HP ${details.hp}`, details?.stats].filter(Boolean).join(' · ');
  return (
    <div className="text-proxy" role="img" aria-label={card.name}>
      <div className="text-proxy-head">
        <div className="text-proxy-title">
          <strong>{card.name}</strong>
          {details?.cost && <CostPips cost={details.cost} />}
        </div>
        {details?.kind && <span>{details.kind}</span>}
      </div>
      <div className="text-proxy-body">
        {details === undefined
          ? <p className="text-proxy-wait">…</p>
          : details?.blocks?.length
          ? details.blocks.map((block, index) => (
            <p key={index}>{block.title && <b>{block.title}{block.meta ? ` (${block.meta})` : ''}. </b>}{block.text}</p>
          ))
          : null}
      </div>
      <div className="text-proxy-foot">
        {stats && <span>{stats}</span>}
        <small>{[card.collectorNumber, card.rarity].filter(Boolean).join(' · ')} · PLAYTEST</small>
      </div>
    </div>
  );
}
