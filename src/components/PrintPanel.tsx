// Print settings panel: how the cards get cut comes first and sets the layout for that method, then the sheet
// (paper, orientation, card size), the backs; spacing, bleed, guides, grid and saved settings sit under "Fine-tuning".
import React, { useState } from 'react';
import {
  cutMethodOf,
  cutMethods,
  withCutMethod,
  type CutMethod,
  clampBackOffset,
  clampBleed,
  clampCardDimension,
  clampGrid,
  clampGuideLength,
  clampGuideWidth,
  clampInset,
  clampMargin,
  clampMarkLength,
  clampMarkThickness,
  clampOffset,
  clampPaperDimension,
  clampSpacing,
  MAX_BLEED,
  MAX_MARGIN,
  MAX_SPACING,
  papers,
  SPACING_STEP,
  type CardGuides,
  type CardSize,
  type Flip,
  type GuidePlacement,
  type Orientation,
  type PageGuides,
  type PageLayout,
  type Paper,
  type PrintPreset,
  type PrintSettings,
} from '../lib/printSettings';
import type { cutterCopy } from '../lib/cutterCopy';
import type { layoutCopy } from '../lib/layoutCopy';
import type { printCopy } from '../lib/printCopy';
import type { Language } from '../lib/i18n';
import { printPanelCopy } from '../lib/printPanelCopy';

type Props = {
  settings: PrintSettings;
  update: (change: (old: PrintSettings) => PrintSettings) => void;
  layout: PageLayout;
  language: Language;
  pc: (typeof printCopy)[Language];
  kc: (typeof cutterCopy)[Language];
  lc: (typeof layoutCopy)[Language];
  pages: number;
  exportingPage: number | null;
  onPng: (index: number) => void;
  onCutFile: () => void;
  mm: (value: number) => string;
  backImage: string | null;
  onChooseBack: (file: File) => void;
  presets: PrintPreset[];
  onSavePreset: (name: string) => void;
  onApplyPreset: (preset: PrintPreset) => void;
  onDeletePreset: (name: string) => void;
};

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string })
{
  return (
    <label className={'print-field' + (className ? ' ' + className : '')}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Mm(
  { label, value, min, max, step = SPACING_STEP, onChange, unit = 'mm' }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    unit?: string;
  },
)
{
  return (
    <span className="mm-input">
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(event.target.valueAsNumber)}
      />
      {unit}
    </span>
  );
}

// Drawn pictograms for the cutting methods: scissors, a trimmer's blade over the sheet, a cutting machine.
function MethodIcon({ method }: { method: CutMethod })
{
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (method === 'scissors')
  {
    return (
      <svg {...common}>
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path d="M8.2 15 19 4M15.8 15 5 4" />
      </svg>
    );
  }
  if (method === 'trimmer')
  {
    return (
      <svg {...common}>
        <rect x="3" y="9" width="18" height="11" rx="1.5" />
        <path d="M3 6h18M12 3v14" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2.5" y="7" width="19" height="7" rx="2" />
      <path d="M5 14v4h14v-4M9 10.5h6M16 4l-2 3" />
    </svg>
  );
}

export function PrintPanel(props: Props)
{
  const { settings, update, layout, pc, kc, lc } = props;
  const [presetName, setPresetName] = useState('');
  const pp = printPanelCopy[props.language];
  const method = cutMethodOf(settings);
  const set = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) =>
    update(old => ({ ...old, [key]: value }));
  const both = (value: number) =>
  {
    const spacing = clampSpacing(value);
    update(old => ({ ...old, spacingX: spacing, spacingY: spacing, bleed: Math.min(old.bleed, spacing / 2) }));
  };
  return (
    <>
      <section className="print-group">
        <h3>{pp.method}</h3>
        <div className="print-methods" role="radiogroup" aria-label={pp.method}>
          {cutMethods.map(item => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={method === item}
              className="print-method"
              onClick={() => update(old => withCutMethod(old, item))}
            >
              <MethodIcon method={item} />
              <b>{pp.methods[item].label}</b>
              <small>{pp.methods[item].hint}</small>
            </button>
          ))}
        </div>
        {method === 'cricut' && (
          <>
            <small className="print-hint">{kc.cricutHint}</small>
            <div className="print-png-list">
              {Array.from({ length: props.pages }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className="secondary"
                  disabled={props.exportingPage !== null}
                  onClick={() => props.onPng(index)}
                >
                  {props.exportingPage === index ? kc.exporting : kc.png(index + 1)}
                </button>
              ))}
            </div>
            <small className="print-hint">
              {kc.pngHint(
                props.mm(layout.columns * layout.cardWidth + (layout.columns - 1) * layout.spacingX),
                props.mm(layout.rows * layout.cardHeight + (layout.rows - 1) * layout.spacingY),
              )}
            </small>
          </>
        )}
        {method === 'brother' && <small className="print-hint">{kc.brotherHint}</small>}
        {method === 'silhouette' && (
          <>
            <Field label={lc.markPoints}>
              <select
                aria-label={lc.markPoints}
                value={settings.markPoints}
                onChange={event => set('markPoints', event.target.value === '4' ? 4 : 3)}
              >
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </Field>
            <Field label={kc.markInset}>
              <Mm
                label={kc.markInset}
                value={layout.markInset}
                min={3}
                max={25}
                onChange={value => set('markInset', clampInset(value))}
              />
            </Field>
            <div className="print-pair">
              <Field label={lc.markLength}>
                <Mm
                  label={lc.markLength}
                  value={layout.markLength}
                  min={3}
                  max={30}
                  step={0.1}
                  onChange={value => set('markLength', clampMarkLength(value))}
                />
              </Field>
              <Field label={lc.markThickness}>
                <Mm
                  label={lc.markThickness}
                  value={layout.markThickness}
                  min={0.2}
                  max={3}
                  step={0.1}
                  onChange={value => set('markThickness', clampMarkThickness(value))}
                />
              </Field>
            </div>
            <small className="print-hint">{lc.markStudio} {kc.marksHint}</small>
          </>
        )}
        {(method === 'silhouette' || method === 'brother') && (
          <>
            <label className="print-toggle">
              <input
                type="checkbox"
                aria-label={kc.rounded}
                checked={settings.rounded}
                onChange={event => set('rounded', event.target.checked)}
              />
              <span>{kc.rounded}</span>
            </label>
            <button type="button" className="secondary print-cutfile" onClick={props.onCutFile}>{kc.cutFile}</button>
            <small className="print-hint">{kc.cutFileHint}</small>
          </>
        )}
      </section>
      <section className="print-group">
        <h3>{pp.sheet}</h3>
        <div className="print-segment" role="group" aria-label={pc.paper}>
          {(['a4', 'letter'] as const).map(key => (
            <button key={key} type="button" aria-pressed={settings.paper === key} onClick={() => set('paper', key)}>
              {papers[key].label}
            </button>
          ))}
          <select
            aria-label={pp.other}
            className={settings.paper !== 'a4' && settings.paper !== 'letter' ? 'is-on' : ''}
            value={settings.paper === 'a4' || settings.paper === 'letter' ? '' : settings.paper}
            onChange={event =>
            {
              if (event.target.value) set('paper', event.target.value as Paper);
            }}
          >
            <option value="">{pp.other}</option>
            {(['legal', 'a3'] as const).map(key => <option key={key} value={key}>{papers[key].label}</option>)}
            <option value="custom">{lc.paperCustom}</option>
          </select>
        </div>
        {settings.paper === 'custom' && (
          <div className="print-pair">
            <Field label={lc.width}>
              <Mm
                label={lc.width}
                value={settings.paperWidth}
                min={80}
                max={600}
                step={1}
                onChange={value => set('paperWidth', clampPaperDimension(value, settings.paperWidth))}
              />
            </Field>
            <Field label={lc.height}>
              <Mm
                label={lc.height}
                value={settings.paperHeight}
                min={80}
                max={600}
                step={1}
                onChange={value => set('paperHeight', clampPaperDimension(value, settings.paperHeight))}
              />
            </Field>
          </div>
        )}
        <div className="print-segment" role="group" aria-label={kc.orientation}>
          {(['portrait', 'landscape'] as const).map(key => (
            <button
              key={key}
              type="button"
              aria-pressed={settings.orientation === key}
              onClick={() => set('orientation', key as Orientation)}
            >
              <span className={'print-orientation is-' + key} aria-hidden="true" />
              {key === 'portrait' ? kc.portrait : kc.landscape}
            </button>
          ))}
        </div>
        <Field label={pp.cards}>
          <select
            aria-label={lc.cardSize}
            value={settings.cardSize}
            onChange={event => set('cardSize', event.target.value as CardSize)}
          >
            {(['auto', 'standard', 'small', 'custom'] as const).map(key => (
              <option key={key} value={key}>
                {lc.cardSizes[key]}
                {key === 'auto' ? ` · ${props.mm(layout.cardWidth)} × ${props.mm(layout.cardHeight)} mm` : ''}
              </option>
            ))}
          </select>
        </Field>
        {settings.cardSize === 'custom' && (
          <div className="print-pair">
            <Field label={lc.width}>
              <Mm
                label={lc.width + ' ' + lc.cardSize}
                value={settings.cardWidth}
                min={20}
                max={200}
                step={0.5}
                onChange={value => set('cardWidth', clampCardDimension(value, settings.cardWidth))}
              />
            </Field>
            <Field label={lc.height}>
              <Mm
                label={lc.height + ' ' + lc.cardSize}
                value={settings.cardHeight}
                min={20}
                max={200}
                step={0.5}
                onChange={value => set('cardHeight', clampCardDimension(value, settings.cardHeight))}
              />
            </Field>
          </div>
        )}
        <p className="print-grid-note">{kc.grid(layout.columns, layout.rows)}</p>
      </section>
      <section className="print-group">
        <h3>{kc.duplex}</h3>
        <label className="print-toggle">
          <input
            type="checkbox"
            aria-label={kc.backs}
            checked={settings.backs}
            onChange={event => set('backs', event.target.checked)}
          />
          <span>
            {kc.backs}
            <small>{kc.backHint}</small>
          </span>
        </label>
        {settings.backs && (
          <>
            <Field label={kc.backImage} className="print-back-field">
              <span className="print-back-picker">
                {props.backImage && <img src={props.backImage} alt="" />}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label={kc.backImage}
                  onChange={event =>
                  {
                    const file = event.target.files?.[0];
                    if (file) props.onChooseBack(file);
                  }}
                />
              </span>
            </Field>
            <Field label={kc.flip}>
              <select
                aria-label={kc.flip}
                value={settings.flip}
                onChange={event => set('flip', event.target.value as Flip)}
              >
                <option value="long">{kc.flipLong}</option>
                <option value="short">{kc.flipShort}</option>
              </select>
            </Field>
            <div className="print-pair">
              <Field label={kc.backOffset + ' X'}>
                <Mm
                  label={kc.backOffset + ' X'}
                  value={settings.backX}
                  min={-5}
                  max={5}
                  step={0.1}
                  onChange={value => set('backX', clampBackOffset(value))}
                />
              </Field>
              <Field label={kc.backOffset + ' Y'}>
                <Mm
                  label={kc.backOffset + ' Y'}
                  value={settings.backY}
                  min={-5}
                  max={5}
                  step={0.1}
                  onChange={value => set('backY', clampBackOffset(value))}
                />
              </Field>
            </div>
            <small className="print-hint">{kc.backOffsetHint}</small>
          </>
        )}
      </section>
      <details className="print-advanced print-fine">
        <summary>{pp.fineTune}</summary>
        <div className="print-advanced-body">
          <Field label={pc.spacing}>
            <Mm label={pc.spacing} value={layout.spacingX} min={0} max={MAX_SPACING} onChange={both} />
          </Field>
          <Field label={pc.bleed}>
            <Mm
              label={pc.bleed}
              value={layout.bleedSize}
              min={0}
              max={MAX_BLEED}
              onChange={value =>
              {
                const bleed = clampBleed(value);
                update(old => ({
                  ...old,
                  bleed,
                  spacingX: Math.max(old.spacingX, bleed * 2),
                  spacingY: Math.max(old.spacingY, bleed * 2),
                }));
              }}
            />
          </Field>
          <small className="print-hint">{kc.bleedHint}</small>
          <Field label={kc.margin}>
            <Mm
              label={kc.margin}
              value={layout.margin}
              min={0}
              max={MAX_MARGIN}
              onChange={value => set('margin', clampMargin(value))}
            />
          </Field>
          <Field label={lc.cardGuides}>
            <select
              aria-label={lc.cardGuides}
              value={settings.cardGuides}
              onChange={event => set('cardGuides', event.target.value as CardGuides)}
            >
              {(['none', 'corners', 'full'] as const).map(key => (
                <option key={key} value={key}>{lc.cardGuideOptions[key]}</option>
              ))}
            </select>
          </Field>
          <Field label={lc.pageGuides}>
            <select
              aria-label={lc.pageGuides}
              value={settings.pageGuides}
              onChange={event => set('pageGuides', event.target.value as PageGuides)}
            >
              {(['none', 'margins', 'full'] as const).map(key => (
                <option key={key} value={key}>{lc.pageGuideOptions[key]}</option>
              ))}
            </select>
          </Field>

          <div className="print-pair">
            <Field label={lc.spacingX}>
              <Mm
                label={lc.spacingX}
                value={layout.spacingX}
                min={0}
                max={MAX_SPACING}
                onChange={value => set('spacingX', Math.max(clampSpacing(value), settings.bleed * 2))}
              />
            </Field>
            <Field label={lc.spacingY}>
              <Mm
                label={lc.spacingY}
                value={layout.spacingY}
                min={0}
                max={MAX_SPACING}
                onChange={value => set('spacingY', Math.max(clampSpacing(value), settings.bleed * 2))}
              />
            </Field>
          </div>
          <div className="print-pair">
            <Field label={lc.columns}>
              <Mm
                label={lc.columns}
                value={settings.columns}
                min={0}
                max={12}
                step={1}
                unit={settings.columns ? '' : lc.auto}
                onChange={value => set('columns', clampGrid(value))}
              />
            </Field>
            <Field label={lc.rows}>
              <Mm
                label={lc.rows}
                value={settings.rows}
                min={0}
                max={12}
                step={1}
                unit={settings.rows ? '' : lc.auto}
                onChange={value => set('rows', clampGrid(value))}
              />
            </Field>
          </div>
          <div className="print-pair">
            <Field label={lc.offset + ' X'}>
              <Mm
                label={lc.offset + ' X'}
                value={settings.offsetX}
                min={-10}
                max={10}
                step={0.1}
                onChange={value => set('offsetX', clampOffset(value))}
              />
            </Field>
            <Field label={lc.offset + ' Y'}>
              <Mm
                label={lc.offset + ' Y'}
                value={settings.offsetY}
                min={-10}
                max={10}
                step={0.1}
                onChange={value => set('offsetY', clampOffset(value))}
              />
            </Field>
          </div>
          <small className="print-hint">{lc.offsetHint}</small>
          {(settings.cardGuides !== 'none' || settings.pageGuides !== 'none') && (
            <>
              <div className="print-pair">
                <Field label={lc.guideLine}>
                  <select
                    aria-label={lc.guideLine}
                    value={settings.guideDashed ? 'dashed' : 'solid'}
                    onChange={event => set('guideDashed', event.target.value === 'dashed')}
                  >
                    <option value="solid">{lc.solid}</option>
                    <option value="dashed">{lc.dashed}</option>
                  </select>
                </Field>
                <Field label={lc.guideShape}>
                  <select
                    aria-label={lc.guideShape}
                    value={settings.guideRounded ? 'rounded' : 'square'}
                    onChange={event => set('guideRounded', event.target.value === 'rounded')}
                  >
                    <option value="square">{lc.square}</option>
                    <option value="rounded">{lc.rounded}</option>
                  </select>
                </Field>
              </div>
              <div className="print-pair">
                <Field label={lc.guideColor}>
                  <input
                    type="color"
                    aria-label={lc.guideColor}
                    value={settings.guideColor}
                    onChange={event => set('guideColor', event.target.value)}
                  />
                </Field>
                <Field label={lc.guideWidth}>
                  <Mm
                    label={lc.guideWidth}
                    value={settings.guideWidth}
                    min={0.05}
                    max={1}
                    step={0.05}
                    onChange={value => set('guideWidth', clampGuideWidth(value))}
                  />
                </Field>
              </div>
              <Field label={lc.placement}>
                <select
                  aria-label={lc.placement}
                  value={settings.guidePlacement}
                  onChange={event => set('guidePlacement', event.target.value as GuidePlacement)}
                >
                  {(['inside', 'center', 'outside'] as const).map(key => (
                    <option key={key} value={key}>{lc.placements[key]}</option>
                  ))}
                </select>
              </Field>
              {settings.cardGuides === 'corners' && (
                <Field label={lc.guideLength}>
                  <Mm
                    label={lc.guideLength}
                    value={settings.guideLength}
                    min={1}
                    max={20}
                    onChange={value => set('guideLength', clampGuideLength(value))}
                  />
                </Field>
              )}
            </>
          )}
        </div>
      </details>
      <section className="print-group">
        <h3>{lc.presets}</h3>
        <form
          className="print-preset-form"
          onSubmit={event =>
          {
            event.preventDefault();
            if (presetName.trim())
            {
              props.onSavePreset(presetName.trim());
              setPresetName('');
            }
          }}
        >
          <input
            type="text"
            maxLength={40}
            aria-label={lc.presetName}
            placeholder={lc.presetName}
            value={presetName}
            onChange={event => setPresetName(event.target.value)}
          />
          <button type="submit" className="secondary" disabled={!presetName.trim()}>{lc.savePreset}</button>
        </form>
        {props.presets.length
          ? (
            <ul className="print-presets">
              {props.presets.map(preset => (
                <li key={preset.name}>
                  <span>{preset.name}</span>
                  <button type="button" className="text-button" onClick={() => props.onApplyPreset(preset)}>
                    {lc.applyPreset}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`${lc.deletePreset} ${preset.name}`}
                    onClick={() => props.onDeletePreset(preset.name)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )
          : <small className="print-hint">{lc.noPresets}</small>}
      </section>
    </>
  );
}
