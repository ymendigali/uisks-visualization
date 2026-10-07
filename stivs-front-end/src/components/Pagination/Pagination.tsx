import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import './Pagination.css';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}

// Page numbers around the current one plus the first and last page, with gaps as "…".
const getPageItems = (page: number, totalPages: number): Array<number | 'gap'> => {
  const pages = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const sorted = [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
  const items: Array<number | 'gap'> = [];
  sorted.forEach((item, index) => {
    if (index > 0 && item - sorted[index - 1] > 1) {
      items.push('gap');
    }
    items.push(item);
  });
  return items;
};

const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onChange, disabled = false }) => {
  const [jumpValue, setJumpValue] = useState('');

  const goTo = (next: number) => {
    const target = Math.min(Math.max(Math.round(next), 1), totalPages);
    if (target !== page) {
      onChange(target);
    }
  };

  const handleJump = (event: React.FormEvent) => {
    event.preventDefault();
    const next = Number(jumpValue);
    if (Number.isFinite(next) && jumpValue.trim()) {
      goTo(next);
    }
    setJumpValue('');
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="Пагинация">
      <button type="button" className="pagination-arrow" onClick={() => goTo(1)} disabled={disabled || page <= 1} aria-label="Первая страница">
        <ChevronsLeft size={16} />
      </button>
      <button type="button" className="pagination-arrow" onClick={() => goTo(page - 1)} disabled={disabled || page <= 1} aria-label="Предыдущая страница">
        <ChevronLeft size={16} />
      </button>

      {getPageItems(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="pagination-gap">…</span>
        ) : (
          <button
            key={item}
            type="button"
            className={item === page ? 'pagination-page pagination-page--active' : 'pagination-page'}
            onClick={() => goTo(item)}
            disabled={disabled}
            aria-current={item === page ? 'page' : undefined}
          >
            {item}
          </button>
        ),
      )}

      <button type="button" className="pagination-arrow" onClick={() => goTo(page + 1)} disabled={disabled || page >= totalPages} aria-label="Следующая страница">
        <ChevronRight size={16} />
      </button>
      <button type="button" className="pagination-arrow" onClick={() => goTo(totalPages)} disabled={disabled || page >= totalPages} aria-label="Последняя страница">
        <ChevronsRight size={16} />
      </button>

      <form className="pagination-jump" onSubmit={handleJump}>
        <label htmlFor="pagination-jump-input">Перейти</label>
        <input
          id="pagination-jump-input"
          type="number"
          min={1}
          max={totalPages}
          inputMode="numeric"
          placeholder={String(page)}
          value={jumpValue}
          onChange={(event) => setJumpValue(event.target.value)}
          disabled={disabled}
        />
      </form>
    </nav>
  );
};

export default Pagination;
