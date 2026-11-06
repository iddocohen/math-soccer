// Structure adapted from math-tank src/app/SettingsPage.tsx: the soccer settings, the same form helpers and data group.
/**
 * Settings page for parents (FR-035, FR-041, contracts/screens.md "Settings").
 *
 * Every field of data-model "Settings", grouped as Zahlenraum, Spielarten, Hinweise, Reihen, Runde, Schwierigkeit, Ton,
 * Bedienung, Kabine and Daten. The form is checked with `validateSettings` on every change; errors appear next to their
 * fields and "Speichern" stays disabled while any error exists. Saving writes through persistence.ts and hands the
 * settings to the app; they apply from the next round (applying them to a running round is amendment 01, T070/T071).
 *
 * The data group (FR-041, as math-tank): "Daten sichern" downloads the export file, "Daten laden" reads one, and
 * "Spielstand übertragen" shows a QR code and "Link kopieren" for the saved data of this browser. The link is built
 * again after "Speichern" and after "Daten laden".
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { GOALS_PER_ROUND_MAX, GOALS_PER_ROUND_MIN, LINE_LENGTH_MAX, LINE_LENGTH_MIN, RANGE_PRESETS } from '../core/settings/defaults';
import type { RangePreset, Settings } from '../core/settings/schema';
import { validateSettings } from '../core/settings/validate';
import { qrMatrix, qrPath, type QrMatrix } from '../core/transfer/qr';
import { encodeTransfer, type EncodedTransfer } from '../core/transfer/transfer';
import { DIRECTIONS, HINT_DISTANCES, MODES } from '../core/types';
import { t } from '../i18n';
import { BUILD_DATE, BUILD_VERSION } from './buildInfo';
import type { Persistence } from './persistence';

const PRESETS: RangePreset[] = ['1-100', '0-1000', 'custom'];

interface Props {
  persistence: Persistence;
  onSaved: (settings: Settings) => void;
  onClose: () => void;
  now?: () => Date;
}

type Notice = { kind: 'ok' | 'warn'; text: string } | null;

/** A whole number from an input's text; NaN for empty or other text. */
function parseWhole(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
}

/** Errors by field path, from `validateSettings`; the preset error shows with the range. */
function collectErrors(s: Settings): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of validateSettings(s)) {
    const path = e.path === 'range.preset' ? 'range' : e.path;
    out.set(path, [...(out.get(path) ?? []), t().settingsErrors[e.key]]);
  }
  return out;
}

/** The local date as YYYY-MM-DD, the day the parent sees on the device. */
function today(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** iOS Safari may cancel a download whose address is revoked at once; a minute is long enough to start it. */
const REVOKE_AFTER_MS = 60_000;

export function SettingsPage({ persistence, onSaved, onClose, now = () => new Date() }: Props) {
  const m = t();
  const S = m.settings;
  const L = S.labels;
  const O = S.options;
  const [draft, setDraft] = useState<Settings>(() => structuredClone(persistence.settings()));
  const [notice, setNotice] = useState<Notice>(null);
  const [dataNotice, setDataNotice] = useState<Notice>(null);
  // Counts saves and imports, so the transfer link is built again from the saved data.
  const [savedCount, setSavedCount] = useState(0);

  const errors = collectErrors(draft);
  const valid = errors.size === 0;
  const errorsAt = (path: string) => errors.get(path) ?? [];

  const update = (next: Settings) => {
    setDraft(next);
    setNotice(null);
  };
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => update({ ...draft, [key]: value });
  /** A switch inside one of the on/off groups. */
  const flag = <G extends 'modes' | 'hintDistance' | 'lineDirections' | 'sound'>(group: G, key: keyof Settings[G] & string) => ({
    checked: (draft[group] as Record<string, boolean>)[key] === true,
    onChange: (v: boolean) => set(group, { ...draft[group], [key]: v }),
  });

  const choosePreset = (preset: RangePreset) => {
    if (preset === 'custom') set('range', { ...draft.range, preset });
    else set('range', { preset, ...RANGE_PRESETS[preset] });
  };

  const save = () => {
    if (!valid) return;
    const r = persistence.saveSettings(draft);
    onSaved(structuredClone(draft));
    setSavedCount((n) => n + 1);
    setNotice(r.ok ? { kind: 'ok', text: S.saved } : { kind: 'warn', text: S.saveFailed });
  };

  const exportFile = () => {
    try {
      const text = persistence.exportText(now());
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `mathe-fussball-${today(now())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    } catch {
      setDataNotice({ kind: 'warn', text: S.data.exportFailed });
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setDataNotice({ kind: 'warn', text: S.data.readFailed });
      return;
    }
    const r = persistence.importText(text);
    if (!r.ok) {
      setDataNotice({ kind: 'warn', text: S.data.importFailed[r.reason] });
      return;
    }
    setDraft(structuredClone(r.settings));
    setNotice(null);
    onSaved(structuredClone(r.settings));
    setSavedCount((n) => n + 1);
    setDataNotice({ kind: 'ok', text: S.data.imported });
  };

  const custom = draft.range.preset === 'custom';

  return (
    <div className="settings-page" role="dialog" aria-modal="true" aria-label={S.title} data-testid="settings-page" lang="de">
      <header className="settings-header">
        <h2>{S.title}</h2>
        <div className="settings-actions">
          <button type="button" className="primary-button" onClick={save} disabled={!valid}>
            {S.save}
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            {m.parent.close}
          </button>
        </div>
        <p className="build-version" data-testid="build-version">
          {S.version(BUILD_VERSION, BUILD_DATE)}
        </p>
      </header>

      <div className="settings-notices" role="status" aria-live="polite">
        {!valid && <p className="notice warn">{S.checkFields}</p>}
        {notice && <p className={`notice ${notice.kind}`}>{notice.text}</p>}
      </div>

      <div className="settings-groups">
        <Group title={S.groups.range} errors={errorsAt('range')}>
          <Select
            label={L.rangePreset}
            value={draft.range.preset}
            options={PRESETS.map((p) => ({ value: p, label: O.rangePreset[p] }))}
            onChange={(v) => choosePreset(v as RangePreset)}
          />
          {custom && (
            <>
              <NumberInput label={L.rangeMin} value={draft.range.min} onChange={(n) => set('range', { ...draft.range, min: n })} />
              <NumberInput label={L.rangeMax} value={draft.range.max} onChange={(n) => set('range', { ...draft.range, max: n })} />
            </>
          )}
        </Group>

        <Group title={S.groups.modes} errors={errorsAt('modes')}>
          {MODES.map((mode) => (
            <Check key={mode} label={O.modes[mode]} {...flag('modes', mode)} />
          ))}
        </Group>

        <Group title={S.groups.hints} errors={errorsAt('hintDistance')}>
          <Select
            label={L.hintDisplay}
            value={draft.hintDisplay}
            options={(['always', 'onRequest'] as const).map((v) => ({ value: v, label: O.hintDisplay[v] }))}
            onChange={(v) => set('hintDisplay', v as Settings['hintDisplay'])}
          />
          <p className="field-label">{L.hintDistance}</p>
          {HINT_DISTANCES.map((d) => (
            <Check key={d} label={O.hintDistance[d]} {...flag('hintDistance', d)} />
          ))}
          <Check label={L.pointAfterFullHelp} checked={draft.pointAfterFullHelp} onChange={(v) => set('pointAfterFullHelp', v)} />
        </Group>

        <Group title={S.groups.lines} errors={errorsAt('lineDirections')}>
          <p className="field-label">{L.lineDirections}</p>
          {DIRECTIONS.map((d) => (
            <Check key={d} label={O.lineDirections[d]} {...flag('lineDirections', d)} />
          ))}
          <NumberInput
            label={L.lineLength}
            value={draft.lineLength}
            min={LINE_LENGTH_MIN}
            max={LINE_LENGTH_MAX}
            errors={errorsAt('lineLength')}
            onChange={(n) => set('lineLength', n)}
          />
        </Group>

        <Group title={S.groups.round}>
          <Select
            label={L.roundType}
            value={draft.roundType}
            options={(['untilHearts', 'goalCount'] as const).map((v) => ({ value: v, label: O.roundType[v] }))}
            onChange={(v) => set('roundType', v as Settings['roundType'])}
          />
          {draft.roundType === 'goalCount' && (
            <NumberInput
              label={L.goalsPerRound}
              value={draft.goalsPerRound}
              min={GOALS_PER_ROUND_MIN}
              max={GOALS_PER_ROUND_MAX}
              errors={errorsAt('goalsPerRound')}
              onChange={(n) => set('goalsPerRound', n)}
            />
          )}
          <Check label={L.showClock} checked={draft.showClock} onChange={(v) => set('showClock', v)} />
          <Check label={L.showRecords} checked={draft.showRecords} onChange={(v) => set('showRecords', v)} />
        </Group>

        <Group title={S.groups.difficulty}>
          <Select
            label={L.difficulty}
            value={draft.difficulty}
            options={(['easy', 'normal', 'challenging'] as const).map((v) => ({ value: v, label: O.difficulty[v] }))}
            onChange={(v) => set('difficulty', v as Settings['difficulty'])}
          />
          <Check label={L.adaptive} checked={draft.adaptive} onChange={(v) => set('adaptive', v)} />
        </Group>

        <Group title={S.groups.sound}>
          <Check label={L.soundEffects} {...flag('sound', 'effects')} />
          <Check label={L.soundCrowd} {...flag('sound', 'crowd')} />
          <Check label={L.soundOhh} {...flag('sound', 'ohh')} />
          <Check label={L.soundSpeech} {...flag('sound', 'speech')} />
        </Group>

        <Group title={S.groups.controls}>
          <Select
            label={L.numberPad}
            value={draft.numberPad}
            options={(['auto', 'always', 'never'] as const).map((v) => ({ value: v, label: O.numberPad[v] }))}
            onChange={(v) => set('numberPad', v as Settings['numberPad'])}
          />
        </Group>

        <Group title={S.groups.lockerRoom}>
          <Check label={L.lockerRoom} checked={draft.lockerRoom} onChange={(v) => set('lockerRoom', v)} />
        </Group>

        <Group title={S.groups.data}>
          <p className="hint">{S.data.exportHint}</p>
          <div className="data-buttons">
            <button type="button" className="secondary-button" onClick={exportFile}>
              {S.data.export}
            </button>
            <label className="secondary-button file-button">
              {S.data.import}
              <input
                type="file"
                accept="application/json,.json"
                data-testid="import-file"
                onChange={(e) => {
                  const input = e.currentTarget;
                  void importFile(input.files?.[0]).finally(() => {
                    input.value = '';
                  });
                }}
              />
            </label>
          </div>
          <div role="status" aria-live="polite">
            {dataNotice && <p className={`notice ${dataNotice.kind}`}>{dataNotice.text}</p>}
          </div>
          <TransferGroup persistence={persistence} savedCount={savedCount} />
        </Group>
      </div>
    </div>
  );
}

/** The link for the saved data; when the browser's compression fails, the uncompressed link. Rejects when both fail. */
async function buildTransfer(persistence: Persistence): Promise<EncodedTransfer> {
  try {
    return await encodeTransfer(persistence.saveData(), window.location.href);
  } catch {
    return encodeTransfer(persistence.saveData(), window.location.href, { codec: null });
  }
}

/** "Spielstand übertragen" (FR-041, as math-tank): a QR code of the transfer link and "Link kopieren". */
function TransferGroup({ persistence, savedCount }: { persistence: Persistence; savedCount: number }) {
  const T = t().transfer;
  const [transfer, setTransfer] = useState<EncodedTransfer | null>(null);
  const [buildFailed, setBuildFailed] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    let live = true;
    buildTransfer(persistence).then(
      (r) => {
        if (!live) return;
        setTransfer(r);
        setBuildFailed(false);
      },
      () => {
        if (!live) return;
        setTransfer(null);
        setBuildFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [persistence, savedCount]);
  const qr = useMemo(() => (transfer?.fits ? qrMatrix(transfer.link) : null), [transfer]);

  const copyLink = async () => {
    if (!transfer) return;
    try {
      await navigator.clipboard.writeText(transfer.link);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <div className="transfer" data-testid="transfer" data-transfer-link={transfer?.link}>
      <h3>{T.title}</h3>
      <p className="hint">{T.hint}</p>
      {qr && <QrSvg qr={qr} label={T.qrLabel} />}
      {buildFailed && <p className="notice warn">{T.buildFailed}</p>}
      {transfer && !transfer.fits && <p className="notice warn">{T.tooLarge}</p>}
      {transfer?.fits && transfer.windowLength < 10 && <p className="notice">{T.trimmed}</p>}
      <button type="button" className="secondary-button" onClick={() => void copyLink()} disabled={!transfer}>
        {T.copy}
      </button>
      <div role="status" aria-live="polite">
        {copy === 'copied' && <p className="notice ok">{T.copied}</p>}
        {copy === 'failed' && <p className="notice warn">{T.copyFailed}</p>}
      </div>
      {copy === 'failed' && transfer && (
        <p className="transfer-link-text" data-testid="transfer-link-text">
          {transfer.link}
        </p>
      )}
    </div>
  );
}

/** A QR code with its white quiet zone (the matrix includes it), drawn with one square per dark module. */
function QrSvg({ qr, label }: { qr: QrMatrix; label: string }) {
  return (
    <svg
      className="transfer-qr"
      data-testid="transfer-qr"
      data-qr-size={qr.size}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
    >
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qrPath(qr)} fill="#000" />
    </svg>
  );
}

/** A settings group with its errors at the end. */
function Group({ title, errors = [], children }: { title: string; errors?: string[]; children: ReactNode }) {
  return (
    <fieldset className="settings-group">
      <legend>{title}</legend>
      {children}
      <Errors errors={errors} />
    </fieldset>
  );
}

function Errors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="field-errors">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="field check-field">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * A whole-number field. It keeps the typed text, so an empty or partial entry stays visible while the parent types,
 * and reports NaN for text that is not a number. A value changed from outside replaces the text.
 */
function NumberInput({
  label,
  value,
  min,
  max,
  errors = [],
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  errors?: string[];
  onChange: (n: number) => void;
}) {
  const id = useId();
  const [text, setText] = useState(() => String(value));
  const [seen, setSeen] = useState(value);
  if (!Object.is(value, seen)) {
    setSeen(value);
    if (!Object.is(parseWhole(text), value) && !Number.isNaN(value)) setText(String(value));
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
        min={min}
        max={max}
        value={text}
        aria-invalid={errors.length > 0 || undefined}
        onChange={(e) => {
          const next = e.currentTarget.value;
          setText(next);
          setSeen(parseWhole(next));
          onChange(parseWhole(next));
        }}
      />
      <Errors errors={errors} />
    </div>
  );
}
