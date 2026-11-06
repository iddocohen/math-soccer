/**
 * The pause screen over the match (amendment 14, FR-116, FR-117). It shows while the child paused the round: with
 * Escape or the pause button it says "Pause", with the home button it asks "Runde beenden?". Both offer "Weiter"
 * (Enter, Space or Escape go on, through keyboard.ts) and "Zum Start", which ends the round without a round end
 * (FR-118). "Zum Start" has no key, and neither button takes focus, so a stray key press never ends a round.
 */
import { t } from '../i18n';
import { noFocus } from './noFocus';

interface Props {
  /** 'pause' after Escape or the pause button; 'quit' after the home button. */
  kind: 'pause' | 'quit';
  onResume: () => void;
  onHome: () => void;
}

export function PauseScreen({ kind, onResume, onHome }: Props) {
  const text = t().match;
  const title = kind === 'quit' ? text.quitAsk : text.pause;
  return (
    <div className="round-end pause-screen" data-testid="pause-screen" data-kind={kind} role="dialog" aria-modal="true" aria-label={title}>
      <h2>{title}</h2>
      <div className="round-end-buttons">
        <button type="button" className="primary" data-testid="pause-resume" {...noFocus} onClick={onResume}>
          {text.resume}
        </button>
        <button type="button" data-testid="pause-home" {...noFocus} onClick={onHome}>
          {text.home}
        </button>
      </div>
    </div>
  );
}
