/**
 * Help step 2 (FR-024, FR-025a, contracts/screens.md "Help chart"): the full chart of the configured range in a modal
 * panel, laid out with the same `layoutChart` as the goal board. The target square has a thick yellow outline; the last
 * typed number is a filled warm square with a ball icon, so the two differ by shape as well as color.
 *
 * It closes with a tap anywhere on it; Enter, Escape and Space close it through MatchController.typeKey, and that
 * Enter does not shoot.
 */
import { memo, useMemo } from 'react';
import { COLUMNS, layoutChart, numberAt } from '../core/chart/layout';
import { COLOR, css } from '../game/palette';
import { t } from '../i18n';

interface Props {
  min: number;
  max: number;
  target: number;
  /** The last number shot at the target, or null before the first shot. */
  lastGuess: number | null;
  onClose: () => void;
}

/** A small soccer ball drawn in SVG, so it looks the same in every browser. */
function BallIcon() {
  return (
    <svg className="help-chart-ball" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#fff" stroke={css(COLOR.ink)} strokeWidth="1.5" />
      <polygon points="10,6 13.8,8.8 12.4,13.2 7.6,13.2 6.2,8.8" fill={css(COLOR.ink)} />
    </svg>
  );
}

export const HelpChart = memo(function HelpChart({ min, max, target, lastGuess, onClose }: Props) {
  const text = t().help;
  const layout = useMemo(() => layoutChart(min, max), [min, max]);
  const rows = useMemo(
    () => Array.from({ length: layout.rows }, (_, row) => Array.from({ length: COLUMNS }, (_, col) => numberAt(layout, row, col))),
    [layout],
  );
  // Many rows need smaller squares; the panel scrolls when they still do not fit.
  const dense = layout.rows > 10;
  return (
    <div
      className="help-chart-backdrop"
      data-testid="help-chart"
      role="dialog"
      aria-modal="true"
      aria-label={text.chartTitle}
      onClick={onClose}
    >
      <div className={dense ? 'help-chart help-chart-dense' : 'help-chart'}>
        <h2>{text.chartTitle}</h2>
        <div className="help-chart-grid" role="grid">
          {rows.map((cells, row) => (
            <div className="help-chart-row" role="row" key={row}>
              {cells.map((n, col) => {
                if (n === null) return <span className="help-chart-cell help-chart-outside" role="gridcell" key={col} />;
                const isTarget = n === target;
                const isLast = n === lastGuess && !isTarget;
                const mark = isTarget ? 'target' : isLast ? 'last' : undefined;
                const cls = ['help-chart-cell', isTarget && 'help-chart-target', isLast && 'help-chart-last'].filter(Boolean).join(' ');
                return (
                  <span
                    className={cls}
                    role="gridcell"
                    key={col}
                    data-n={n}
                    data-mark={mark}
                    aria-label={isTarget ? `${n}: ${text.chartTarget}` : isLast ? `${n}: ${text.chartLast}` : undefined}
                  >
                    {isLast && <BallIcon />}
                    {n}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <p className="help-chart-legend">
          <span className="help-chart-key help-chart-target" aria-hidden="true" /> {text.chartTarget}
          {lastGuess !== null && lastGuess !== target && (
            <>
              <span className="help-chart-key help-chart-last" aria-hidden="true">
                <BallIcon />
              </span>{' '}
              {text.chartLast}
            </>
          )}
        </p>
        <button type="button" className="primary" onClick={onClose}>
          {text.chartClose}
        </button>
      </div>
    </div>
  );
});
