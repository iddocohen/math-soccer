// Structure adapted from math-tank src/app/Garage.tsx (the star shop), without giving items back or item numbers.
/**
 * The locker room ("Kabine", FR-043, FR-044; contracts/screens.md "Locker room"). Opened from the start screen with
 * the "Kabine" button or K, only when the parent turned the locker room on. It shows a preview of the player and the
 * ball, the star balance, and four groups: Ball, Trikot, Nummer und Name, Fans.
 *
 * - An owned or free item is chosen with one tap, at no cost.
 * - An item not owned shows its price. When the balance reaches it, a tap asks "Für N Sterne kaufen?" with "Ja" and
 *   "Nein"; "Ja" buys and chooses it. Otherwise the item shows "noch N Sterne" and does nothing.
 * - The shirt number takes 1 to 99, the shirt name up to 10 letters; both save as the child types.
 * - Escape goes back (or answers "Nein" while the question shows); "Zurück" goes back.
 *
 * The app's game keys are off while the locker room shows; this screen has its own key listener for Escape.
 * For tests: `data-testid="locker-room"` with `data-stars`, every item `data-testid="item-<id>"` with `data-owned`,
 * `data-locked` and `data-chosen`.
 */
import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { COLOR, css } from '../game/palette';
import { BALL_COLORS, ballDesign, ITEMS, ITEM_KINDS, type BallDesign, type ItemKind, type LockerItem } from '../core/rewards/items';
import {
  buy,
  canBuy,
  chosen,
  equip,
  isOwned,
  lookOf,
  setShirtName,
  setShirtNumber,
  SHIRT_NAME_MAX,
  starsNeeded,
  type Look,
} from '../core/rewards/lockerRoom';
import type { LockerRoom as LockerData } from '../core/storage/schemas';
import { t } from '../i18n';

interface Props {
  locker: LockerData;
  /** A purchase, a choice, or a new number or name; the app stores it. */
  onChange: (locker: LockerData) => void;
  onBack: () => void;
}

const GROUP: Record<ItemKind, 'ball' | 'shirt' | 'fans'> = { ball: 'ball', shirt: 'shirt', scarf: 'fans' };

/** True for colors where dark text reads better than light text. */
function isLight(color: number): boolean {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export function BallIcon({ design, size = 40 }: { design: BallDesign; size?: number }): ReactElement {
  const fill = css(BALL_COLORS[design].fill);
  const mark = css(BALL_COLORS[design].mark);
  const gradient = `ball-gradient${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id={gradient}>
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#3498db" />
          <stop offset="50%" stopColor="#2ecc71" />
          <stop offset="70%" stopColor="#f1c40f" />
          <stop offset="85%" stopColor="#f39c12" />
          <stop offset="100%" stopColor="#e74c3c" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={design === 'rainbow' ? `url(#${gradient})` : fill} stroke="rgb(0 0 0 / 30%)" />
      {design === 'stars' ? (
        <text x="20" y="27" textAnchor="middle" fontSize="20" fill={mark}>
          ★
        </text>
      ) : design === 'flames' ? (
        <path d="M8 34 L14 18 L18 28 L20 12 L24 28 L28 18 L32 34 Z" fill={mark} />
      ) : design === 'rainbow' ? null : (
        <circle cx="20" cy="20" r="7" fill={mark} />
      )}
    </svg>
  );
}

/** The player from behind with the shirt color, the name and the number, and the ball at his feet. */
function Preview({ look, label }: { look: Look; label: string }): ReactElement {
  const shirt = css(look.shirtColor);
  const ink = isLight(look.shirtColor) ? css(COLOR.ink) : css(COLOR.chalk);
  return (
    <figure className="locker-preview" data-testid="locker-preview" data-ball={`ball.${look.ball}`} aria-label={label}>
      <svg width="160" height="200" viewBox="0 0 160 200" aria-hidden="true">
        <circle cx="70" cy="34" r="24" fill={css(COLOR.hair)} />
        <rect x="30" y="60" width="80" height="80" rx="12" fill={shirt} />
        <rect x="20" y="64" width="14" height="30" fill={shirt} />
        <rect x="106" y="64" width="14" height="30" fill={shirt} />
        <text x="70" y="80" textAnchor="middle" fontSize="12" fontWeight="800" fill={ink} data-testid="preview-name">
          {look.shirtName.toUpperCase()}
        </text>
        <text x="70" y="122" textAnchor="middle" fontSize="38" fontWeight="800" fill={ink} data-testid="preview-number">
          {look.shirtNumber}
        </text>
        <rect x="36" y="140" width="30" height="30" fill={css(COLOR.chalk)} />
        <rect x="74" y="140" width="30" height="30" fill={css(COLOR.chalk)} />
        <rect x="40" y="170" width="22" height="26" fill={css(COLOR.skin)} />
        <rect x="78" y="170" width="22" height="26" fill={css(COLOR.skin)} />
      </svg>
      <BallIcon design={look.ball} size={48} />
    </figure>
  );
}

function ItemPicture({ item }: { item: LockerItem }): ReactElement {
  if (item.kind === 'ball') return <BallIcon design={ballDesign(item.id)} />;
  return <span className={`locker-swatch locker-swatch-${item.kind}`} style={{ background: css(item.color ?? 0) }} aria-hidden="true" />;
}

export function LockerRoom({ locker, onChange, onBack }: Props): ReactElement {
  const L = t().lockerRoom;
  const [question, setQuestion] = useState<LockerItem | null>(null);
  const [numberText, setNumberText] = useState(String(locker.shirtNumber));
  const latest = useRef({ question, onBack });
  latest.current = { question, onBack };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (latest.current.question) setQuestion(null);
      else latest.current.onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const choose = (item: LockerItem) => {
    if (isOwned(locker, item.id)) onChange(equip(locker, item.kind, item.id));
    else if (canBuy(locker, item.id)) setQuestion(item);
  };

  const answer = (yes: boolean) => {
    if (yes && question) onChange(buy(locker, question.id));
    setQuestion(null);
  };

  const typeNumber = (typed: string) => {
    const digits = typed.replace(/\D/g, '').slice(0, 2);
    setNumberText(digits);
    const next = setShirtNumber(locker, Number(digits));
    if (next !== locker) onChange(next);
  };

  const items = (kind: ItemKind) => (
    <div className="locker-items">
      {ITEMS.filter((i) => i.kind === kind).map((item) => {
        const owned = isOwned(locker, item.id);
        const open = owned || canBuy(locker, item.id);
        const isChosen = chosen(locker, kind) === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className="locker-item"
            data-testid={`item-${item.id}`}
            data-owned={String(owned)}
            data-locked={String(!open)}
            data-chosen={String(isChosen)}
            aria-disabled={open ? undefined : 'true'}
            aria-pressed={owned ? isChosen : undefined}
            onClick={() => choose(item)}
          >
            <ItemPicture item={item} />
            <span className="locker-item-name">{L.items[item.id]}</span>
            {!owned && <span className="locker-item-price">{open ? L.price(item.price) : L.stillNeeded(starsNeeded(locker, item.id))}</span>}
            {isChosen && <span className="locker-item-chosen">{L.chosen}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <main className="locker-room" lang="de" data-testid="locker-room" data-stars={locker.stars} aria-label={L.title}>
      <header className="locker-header">
        <h1>{L.title}</h1>
        <span className="star-total" data-testid="locker-stars">
          {t().start.stars(locker.stars)}
        </span>
        <button type="button" onClick={onBack}>
          {L.back}
        </button>
      </header>
      <div className="locker-body">
        <Preview look={lookOf(locker)} label={L.preview} />
        <div className="locker-groups">
          {ITEM_KINDS.filter((k) => k !== 'scarf').map((kind) => (
            <section key={kind} className="locker-group" aria-label={L.groups[GROUP[kind]]}>
              <h2>{L.groups[GROUP[kind]]}</h2>
              {items(kind)}
            </section>
          ))}
          <section className="locker-group" aria-label={L.groups.numberName}>
            <h2>{L.groups.numberName}</h2>
            <div className="locker-fields">
              <label>
                {L.shirtNumber}
                <input
                  type="text"
                  inputMode="numeric"
                  data-testid="shirt-number"
                  value={numberText}
                  maxLength={2}
                  aria-describedby="shirt-number-hint"
                  onChange={(e) => typeNumber(e.target.value)}
                  onBlur={() => setNumberText(String(locker.shirtNumber))}
                />
                <span id="shirt-number-hint" className="hint">
                  {L.shirtNumberHint}
                </span>
              </label>
              <label>
                {L.shirtName}
                <input
                  type="text"
                  data-testid="shirt-name"
                  value={locker.shirtName}
                  maxLength={SHIRT_NAME_MAX}
                  autoComplete="off"
                  aria-describedby="shirt-name-hint"
                  onChange={(e) => onChange(setShirtName(locker, e.target.value))}
                />
                <span id="shirt-name-hint" className="hint">
                  {L.shirtNameHint}
                </span>
              </label>
            </div>
          </section>
          <section className="locker-group" aria-label={L.groups.fans}>
            <h2>{L.groups.fans}</h2>
            {items('scarf')}
          </section>
        </div>
      </div>
      {question && (
        <div className="parent-menu-backdrop">
          <div className="parent-menu" role="dialog" aria-modal="true" data-testid="buy-question" aria-labelledby="buy-question-text">
            <p id="buy-question-text">{L.buyQuestion(question.price)}</p>
            <div className="round-end-buttons">
              <button type="button" className="primary" onClick={() => answer(true)}>
                {L.yes}
              </button>
              <button type="button" onClick={() => answer(false)}>
                {L.no}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
