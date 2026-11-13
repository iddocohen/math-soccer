/**
 * The start card of "Papa gegen Kind" (amendment 23, FR-158, FR-159): before the shootout, the grown-up types a name
 * ("Papa" by default) and picks a level (6 by default). "Los geht's" (or Enter) starts the shootout; "Zurück" (or
 * Escape) goes back to the start screen. The fields keep what was chosen last in this session.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { cleanGrownupName, GROWNUP_NAME_MAX, type FamilySetup } from '../core/match/family';
import { LEVELS, type Level } from '../core/settings/defaults';
import { t } from '../i18n';

interface Props {
  initial: FamilySetup;
  onStart: (setup: FamilySetup) => void;
  onBack: () => void;
}

export function FamilyCard({ initial, onStart, onBack }: Props) {
  const text = t().family;
  const [name, setName] = useState(initial.name);
  const [level, setLevel] = useState<Level>(initial.level);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onBack]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart({ name: cleanGrownupName(name), level });
  };

  return (
    <div className="round-end family-card" data-testid="family-card" role="dialog" aria-modal="true" aria-label={text.title}>
      <form className="family-form" onSubmit={submit}>
        <h2>{text.title}</h2>
        <p className="family-hint">{text.hint}</p>
        <label className="family-field">
          <span>{text.name}</span>
          <input
            type="text"
            data-testid="family-name"
            value={name}
            maxLength={GROWNUP_NAME_MAX}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <fieldset className="family-field family-levels">
          <legend>{text.level}</legend>
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              className={l === level ? 'family-level family-level-chosen' : 'family-level'}
              data-testid={`family-level-${l}`}
              aria-pressed={l === level}
              onClick={() => setLevel(l)}
            >
              {l}
            </button>
          ))}
        </fieldset>
        <div className="round-end-buttons">
          <button type="submit" className="primary" data-testid="family-start" autoFocus>
            {text.start}
          </button>
          <button type="button" onClick={onBack}>
            {text.back}
          </button>
        </div>
      </form>
    </div>
  );
}
