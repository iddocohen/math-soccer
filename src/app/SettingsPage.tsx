// Structure adapted from math-tank src/app/SettingsPage.tsx: the soccer settings, the same form helpers and data group.
/**
 * Settings page for parents (FR-035, FR-041, contracts/screens.md "Settings").
 *
 * The fields of data-model "Settings", grouped as Zahlenraum, Hinweise, Formen, Runde, Zeit-Challenge, Pokal ("Tore pro
 * Spiel", 3 to 10, amendment 13), Schwierigkeit,
 * Ton, Bedienung, Kabine and Daten (FR-069, FR-074, FR-076, FR-085). "Schwierigkeit" holds the shots per ball, the
 * adaptive switch, "Stufe am Anfang" and "Schwerste Stufe", with a small example drawing per level. The form is checked
 * with `validateSettings` on every change; errors appear next to their fields and "Speichern" stays disabled while any
 * error exists. Saving writes through persistence.ts and hands the
 * settings to the app; they apply from the next round (applying them to a running round is amendment 01, T070/T071).
 *
 * The data group (FR-041, as math-tank): "Daten sichern" downloads the export file, "Daten laden" reads one, and
 * "Spielstand übertragen" shows a QR code and "Link kopieren" for the saved data of this browser. The link is built
 * again after "Speichern" and after "Daten laden".
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { CHALLENGE_MINUTES, CUP_GOALS_MAX, CUP_GOALS_MIN, GOALS_PER_ROUND_MAX, GOALS_PER_ROUND_MIN, LEVELS, RANGE_PRESETS, type ChallengeMinutes, type Level } from '../core/settings/defaults';
import type { RangePreset, Settings } from '../core/settings/schema';
import { validateSettings } from '../core/settings/validate';
import { SHAPE_IDS } from '../core/targets/shapes';
import { qrMatrix, qrPath, type QrMatrix } from '../core/transfer/qr';
import { encodeTransfer, type EncodedTransfer } from '../core/transfer/transfer';
import { HINT_DISTANCES } from '../core/types';
import { KEEPER_SPEEDS } from '../core/match/keeper';
import { t } from '../i18n';
import { BUILD_DATE, BUILD_VERSION } from './buildInfo';
import { LevelExamples } from './LevelExamples';
import type { Persistence } from './persistence';

const PRESETS: RangePreset[] = ['1-100', '0-1000', 'custom'];

/** "Stufe 1: Gerade Linien" to "Stufe 5: X-Form", for both level selects. */
function levelOptionsOf(): Array<{ value: string; label: string }> {
  const T = t().levels;
  return LEVELS.map((l) => ({ value: String(l), label: T.label(l, T.names[l]) }));
}


interface Props {
  persistence: Persistence;
  onSaved: (settings: Settings) => void;
  onClose: () => void;
  now?: () => Date;
  /** After "Kopie wiederherstellen" (FR-050): the page reloads, so every screen uses the restored data. */
  onRestored?: () => void;
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

export function SettingsPage({ persistence, onSaved, onClose, now = () => new Date(), onRestored = () => window.location.reload() }: Props) {
  const m = t();
  // Amendment 01 (FR-050): data kept as a copy that this version can read again.
  const [backups] = useState(() => persistence.backups());
  const [restoreFailed, setRestoreFailed] = useState<'failed' | 'partial' | null>(null);
  const restore = () => {
    const r = persistence.restoreBackups();
    if (r.ok) onRestored();
    else setRestoreFailed(r.partial ? 'partial' : 'failed');
  };
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
  const flag = <G extends 'hintDistance' | 'shapes' | 'sound' | 'modesAllowed'>(group: G, key: keyof Settings[G] & string) => ({
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
      a.download = `mathe-kicker-${today(now())}.json`;
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
  const levelOptions = levelOptionsOf();

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
        {backups.length > 0 && (
          <div className="notice" data-testid="backup-notice">
            <p>{m.parent.backupFound(backups.map((kind) => m.parent.dataNames[kind]).join(', '))}</p>
            <button type="button" className="secondary-button" onClick={restore}>
              {m.parent.restoreBackup}
            </button>
          </div>
        )}
        {restoreFailed && <p className="notice warn">{restoreFailed === 'partial' ? m.parent.savePartial : m.parent.restoreFailed}</p>}
      </div>

      <div className="settings-groups">
        <Group title={S.groups.range} errors={errorsAt('range')}>
          <Select
            label={L.rangePreset}
            value={draft.range.preset}
            options={options(PRESETS, O.rangePreset)}
            onChange={choosePreset}
          />
          {custom && (
            <>
              <NumberInput label={L.rangeMin} value={draft.range.min} onChange={(n) => set('range', { ...draft.range, min: n })} />
              <NumberInput label={L.rangeMax} value={draft.range.max} onChange={(n) => set('range', { ...draft.range, max: n })} />
            </>
          )}
        </Group>

        <Group title={S.groups.hints} errors={errorsAt('hintDistance')}>
          <Select
            label={L.hintDisplay}
            value={draft.hintDisplay}
            options={options(['always', 'onRequest'] as const, O.hintDisplay)}
            onChange={(v) => set('hintDisplay', v)}
          />
          <p className="field-label">{L.hintDistance}</p>
          {HINT_DISTANCES.map((d) => (
            <Check key={d} label={O.hintDistance[d]} {...flag('hintDistance', d)} />
          ))}
          <Check label={L.pointAfterFullHelp} checked={draft.pointAfterFullHelp} onChange={(v) => set('pointAfterFullHelp', v)} />
          <Check label={L.rowColumnHelper} checked={draft.rowColumnHelper} onChange={(v) => set('rowColumnHelper', v)} />
        </Group>

        <Group title={S.groups.shapes}>
          {SHAPE_IDS.map((k) => (
            <Check key={k} label={O.shapes[k]} {...flag('shapes', k)} />
          ))}
        </Group>

        <Group title={S.groups.round}>
          <Select
            label={L.roundType}
            value={draft.roundType}
            options={options(['untilHearts', 'goalCount'] as const, O.roundType)}
            onChange={(v) => set('roundType', v)}
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

        <Group title={S.groups.timeChallenge}>
          <Check
            label={L.timeChallengeAllowed}
            checked={draft.timeChallenge.allowed}
            onChange={(v) => set('timeChallenge', { ...draft.timeChallenge, allowed: v })}
          />
          <Select
            label={L.timeChallengeMinutes}
            value={String(draft.timeChallenge.minutes)}
            options={CHALLENGE_MINUTES.map((n) => ({ value: String(n), label: O.challengeMinutes(n) }))}
            onChange={(v) => set('timeChallenge', { ...draft.timeChallenge, minutes: Number(v) as ChallengeMinutes })}
          />
        </Group>

        <Group title={S.groups.cup}>
          <Select
            label={L.cupGoals}
            value={String(draft.cupGoals)}
            options={Array.from({ length: CUP_GOALS_MAX - CUP_GOALS_MIN + 1 }, (_, i) => String(CUP_GOALS_MIN + i)).map((v) => ({ value: v, label: v }))}
            onChange={(v) => set('cupGoals', Number(v))}
          />
        </Group>

        <Group title={S.groups.difficulty} errors={errorsAt('levels')}>
          <Select
            label={L.difficulty}
            value={draft.difficulty}
            options={options(['easy', 'normal', 'challenging'] as const, O.difficulty)}
            onChange={(v) => set('difficulty', v)}
          />
          <Check label={L.adaptive} checked={draft.adaptive} onChange={(v) => set('adaptive', v)} />
          <Select
            label={L.startLevel}
            value={String(draft.levels.start)}
            options={levelOptions}
            onChange={(v) => set('levels', { ...draft.levels, start: Number(v) as Level })}
          />
          <Select
            label={L.hardestLevel}
            value={String(draft.levels.hardest)}
            options={levelOptions}
            onChange={(v) => set('levels', { ...draft.levels, hardest: Number(v) as Level })}
          />
          <LevelExamples label={L.levelExamples} start={draft.levels.start} hardest={draft.levels.hardest} />
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
            options={options(['auto', 'always', 'never'] as const, O.numberPad)}
            onChange={(v) => set('numberPad', v)}
          />
        </Group>

        <Group title={S.groups.lockerRoom}>
          <Check label={L.lockerRoom} checked={draft.lockerRoom} onChange={(v) => set('lockerRoom', v)} />
        </Group>

        {/* "Spielarten erlauben" (amendment 21, FR-141): a mode turned off here has no start screen button. */}
        <Group title={S.groups.modes}>
          <p className="hint">{L.modesHint}</p>
          <Check label={O.modes.wall} {...flag('modesAllowed', 'wall')} />
          <Check label={O.modes.keeper} {...flag('modesAllowed', 'keeper')} />
          <Check label={O.modes.shootout} {...flag('modesAllowed', 'shootout')} />
          {/* "Schussgeschwindigkeit" of "Selbst ins Tor" (FR-144). */}
          <Select
            label={L.keeperSpeed}
            value={draft.keeperSpeed}
            options={options(KEEPER_SPEEDS, O.keeperSpeed)}
            onChange={(v) => set('keeperSpeed', v)}
          />
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

/** Select options for `values`, labeled from `labels`. */
function options<V extends string>(values: readonly V[], labels: Record<V, string>): Array<{ value: V; label: string }> {
  return values.map((value) => ({ value, label: labels[value] }));
}

function Select<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: Array<{ value: V; label: string }>;
  onChange: (v: V) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.currentTarget.value as V)}>
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
