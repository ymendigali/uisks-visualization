import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';
import './YearRangeFilter.css';

interface YearRangeFilterProps {
  idPrefix: string;
  min: number;
  max: number;
  startYear: number;
  endYear: number;
  // Projects per year (counted without the period filter), drawn as a histogram.
  counts?: Array<{ value: number; count: number }>;
  onApply: (startYear: number, endYear: number) => void;
}

type Mode = 'range' | 'single';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Scopus-style period picker: histogram of projects per year, a two-thumb slider,
// "from"/"to" inputs and an apply button; "Один год" narrows it to a single year.
const YearRangeFilter: React.FC<YearRangeFilterProps> = ({
  idPrefix,
  min,
  max,
  startYear,
  endYear,
  counts = [],
  onApply,
}) => {
  const [mode, setMode] = useState<Mode>(startYear === endYear ? 'single' : 'range');
  const [draftStart, setDraftStart] = useState(startYear);
  const [draftEnd, setDraftEnd] = useState(endYear);
  const [startText, setStartText] = useState(String(startYear));
  const [endText, setEndText] = useState(String(endYear));

  useEffect(() => {
    setDraftStart(startYear);
    setDraftEnd(endYear);
    setStartText(String(startYear));
    setEndText(String(endYear));
  }, [startYear, endYear]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = min; year <= max; year += 1) list.push(year);
    return list;
  }, [min, max]);

  const countByYear = useMemo(() => new Map(counts.map((item) => [item.value, item.count])), [counts]);
  const maxCount = Math.max(1, ...years.map((year) => countByYear.get(year) ?? 0));

  const setRange = (nextStart: number, nextEnd: number) => {
    const from = clamp(Math.min(nextStart, nextEnd), min, max);
    const to = clamp(Math.max(nextStart, nextEnd), min, max);
    setDraftStart(from);
    setDraftEnd(to);
    setStartText(String(from));
    setEndText(String(to));
  };

  const handleModeChange = (next: Mode) => {
    setMode(next);
    if (next === 'single') setRange(draftEnd, draftEnd);
  };

  const commitText = () => {
    const from = Number(startText);
    const to = mode === 'single' ? from : Number(endText);
    if (Number.isFinite(from) && Number.isFinite(to) && startText.trim() && (mode === 'single' || endText.trim())) {
      setRange(from, to);
      return { from: clamp(Math.min(from, to), min, max), to: clamp(Math.max(from, to), min, max) };
    }
    setRange(draftStart, draftEnd);
    return { from: draftStart, to: draftEnd };
  };

  const handleApply = (event: React.FormEvent) => {
    event.preventDefault();
    const { from, to } = commitText();
    onApply(from, to);
  };

  const total = Math.max(max - min, 1);
  const sliderStyle = {
    '--range-start': `${((draftStart - min) / total) * 100}%`,
    '--range-end': `${((draftEnd - min) / total) * 100}%`,
  } as CSSProperties;

  return (
    <form className="year-range-filter" onSubmit={handleApply}>
      <div className="year-range-modes" role="radiogroup">
        {(['range', 'single'] as const).map((value) => (
          <label key={value} className="year-range-mode">
            <input
              type="radio"
              name={`${idPrefix}-mode`}
              checked={mode === value}
              onChange={() => handleModeChange(value)}
            />
            {value === 'range' ? 'Диапазон' : 'Один год'}
          </label>
        ))}
      </div>

      <div className="year-range-histogram" aria-hidden="true">
        {years.map((year) => {
          const count = countByYear.get(year) ?? 0;
          const inRange = year >= draftStart && year <= draftEnd;
          return (
            <button
              key={year}
              type="button"
              tabIndex={-1}
              className={inRange ? 'year-range-bar year-range-bar--active' : 'year-range-bar'}
              style={{ height: `${Math.max((count / maxCount) * 100, count > 0 ? 4 : 1)}%` }}
              title={`${year}: ${count.toLocaleString('ru-RU')}`}
              onClick={() => (mode === 'single' ? setRange(year, year) : setRange(Math.min(draftStart, year), Math.max(draftEnd, year)))}
            />
          );
        })}
      </div>

      <div className="period-range-slider year-range-slider" style={sliderStyle}>
        <div className="period-range-track" />
        <div className="period-range-inputs">
          {mode === 'range' && (
            <input
              type="range"
              min={min}
              max={max}
              value={draftStart}
              aria-label="Год начала"
              onChange={(event) => setRange(Math.min(Number(event.target.value), draftEnd), draftEnd)}
              className="period-range-thumb"
            />
          )}
          <input
            type="range"
            min={min}
            max={max}
            value={draftEnd}
            aria-label={mode === 'range' ? 'Год окончания' : 'Год'}
            onChange={(event) =>
              mode === 'single'
                ? setRange(Number(event.target.value), Number(event.target.value))
                : setRange(draftStart, Math.max(Number(event.target.value), draftStart))
            }
            className="period-range-thumb period-range-thumb--upper"
          />
        </div>
      </div>

      <div className="year-range-inputs">
        <input
          id={`${idPrefix}-start`}
          type="number"
          min={min}
          max={max}
          value={startText}
          aria-label={mode === 'range' ? 'С года' : 'Год'}
          onChange={(event) => setStartText(event.target.value)}
          onBlur={commitText}
        />
        {mode === 'range' && (
          <>
            <span className="year-range-dash">–</span>
            <input
              id={`${idPrefix}-end`}
              type="number"
              min={min}
              max={max}
              value={endText}
              aria-label="По год"
              onChange={(event) => setEndText(event.target.value)}
              onBlur={commitText}
            />
          </>
        )}
        <button type="submit" className="year-range-apply" aria-label="Применить период">
          <ChevronRight size={18} />
        </button>
      </div>
    </form>
  );
};

export default YearRangeFilter;
