/**
 * The example drawings of the difficulty levels on the settings page (FR-085). Each level shows a small grid of 5 by 5
 * squares: the lit hint squares filled, the empty target squares as outlines. Levels outside the chosen range are
 * shown faded, so the parent sees which levels the child will meet.
 */
import { LEVELS, type Level } from '../core/settings/defaults';
import { t } from '../i18n';

type Cell = readonly [row: number, col: number];

/** One example per level: lit squares and empty squares, as [row, column] in a grid of 5 by 5. */
const EXAMPLES: Record<Level, { lit: readonly Cell[]; empty: readonly Cell[] }> = {
  // Nachbarn across and down.
  1: { lit: [[1, 2], [2, 1], [2, 3], [3, 2]], empty: [[2, 2]] },
  // Reihe on a diagonal.
  2: { lit: [[0, 0], [1, 1]], empty: [[2, 2]] },
  // A T shape with one empty square.
  3: { lit: [[1, 1], [1, 2], [1, 3]], empty: [[2, 2]] },
  // An L shape with two empty squares.
  4: { lit: [[1, 1], [2, 1]], empty: [[3, 1], [3, 2]] },
  // The X shape with the centre empty.
  5: { lit: [[1, 1], [1, 3], [3, 1], [3, 3]], empty: [[2, 2]] },
};

const SIZE = 5;
const CELL = 12;

function Example({ level }: { level: Level }) {
  const { lit, empty } = EXAMPLES[level];
  const at = (c: Cell) => ({ x: c[1] * CELL + 1, y: c[0] * CELL + 1, width: CELL - 2, height: CELL - 2 });
  return (
    <svg className="level-example" viewBox={`0 0 ${SIZE * CELL} ${SIZE * CELL}`} width={SIZE * CELL} height={SIZE * CELL} aria-hidden="true">
      {Array.from({ length: SIZE * SIZE }, (_, i) => (
        <rect key={i} className="level-example-square" {...at([Math.floor(i / SIZE), i % SIZE])} />
      ))}
      {lit.map((c) => (
        <rect key={`l${c[0]}-${c[1]}`} className="level-example-lit" {...at(c)} />
      ))}
      {empty.map((c) => (
        <rect key={`e${c[0]}-${c[1]}`} className="level-example-empty" {...at(c)} />
      ))}
    </svg>
  );
}

export function LevelExamples({ label, start, hardest }: { label: string; start: Level; hardest: Level }) {
  const T = t().levels;
  return (
    <div className="level-examples" data-testid="level-examples">
      <p className="field-label">{label}</p>
      <ul>
        {LEVELS.map((l) => (
          <li key={l} data-level={l} data-in-range={l >= start && l <= hardest} className={l >= start && l <= hardest ? '' : 'level-out'}>
            <Example level={l} />
            <span>{T.label(l, T.names[l])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
