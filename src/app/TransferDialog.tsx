// Copied from math-tank src/app/TransferDialog.tsx.
/**
 * The dialog when the game opens with a save link (FR-041, contracts/screens.md "Transfer dialog"). It is for the
 * parent: "Übernehmen" needs a 2-second press and hold like the parent gate, so a child who opens
 * the link cannot take over a save by accident; a short tap and keys do nothing. "Abbrechen" changes nothing. A code
 * that cannot be read says so, with "Schließen". When storing the save fails, the dialog says that nothing was changed;
 * the app then keeps `#save=` in the address, so a reload asks again. When part of the save was stored and the old data
 * could not be put back ('partial'), the dialog says so instead.
 */
import type { TransferSummary } from '../core/transfer/transfer';
import { t } from '../i18n';
import { useHold } from './useHold';

const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** 'failed': "Übernehmen" could not store the save, and nothing was changed; 'partial': part of it was stored. */
export type TransferDialogState = { kind: 'ready'; summary: TransferSummary } | { kind: 'invalid' } | { kind: 'failed' } | { kind: 'partial' };

/** The heading of a dialog that is not ready. */
function closedText(kind: 'invalid' | 'failed' | 'partial'): string {
  const m = t().transfer;
  return kind === 'failed' ? m.saveFailed : kind === 'partial' ? m.savePartial : m.invalid;
}

interface Props {
  state: TransferDialogState;
  onAccept: () => void;
  onCancel: () => void;
}

export function TransferDialog({ state, onAccept, onCancel }: Props) {
  const m = t().transfer;
  const { progress, handlers } = useHold(onAccept, state.kind === 'ready');
  return (
    <div className="parent-menu-backdrop transfer-backdrop">
      <div className="parent-menu transfer-dialog" role="dialog" aria-modal="true" aria-label={state.kind === 'ready' ? m.receiveTitle : closedText(state.kind)} data-testid="transfer-dialog">
        {state.kind === 'ready' ? (
          <>
            <h2>{m.receiveTitle}</h2>
            <p className="transfer-summary">{m.summary(state.summary.stars, state.summary.record, state.summary.min, state.summary.max)}</p>
            <p className="hint">{m.receiveHint}</p>
            <p className="hint">{m.holdHint}</p>
            <button type="button" className="primary-button hold-button" tabIndex={-1} {...handlers}>
              <svg className="hold-ring" data-testid="transfer-accept-ring" data-progress={progress} viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r={RING_RADIUS} strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - progress)} />
              </svg>
              <span>{m.accept}</span>
            </button>
            <button type="button" className="secondary-button" onClick={onCancel}>
              {m.decline}
            </button>
          </>
        ) : (
          <>
            <h2>{closedText(state.kind)}</h2>
            <button type="button" className="secondary-button" onClick={onCancel}>
              {m.close}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
