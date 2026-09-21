import React, { useEffect, useMemo, useRef, useState } from 'react';
import './SearchableSelect.css';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  allValue?: string;
  allLabel: string;
  placeholder?: string;
  maxVisibleOptions?: number;
}

const normalize = (value: string): string => value.toLowerCase().trim();

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  value,
  onChange,
  options,
  allValue = 'all',
  allLabel,
  placeholder,
  maxVisibleOptions = 50,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(() => {
    if (value === allValue) {
      return '';
    }
    return options.find((option) => option.value === value)?.label ?? value;
  }, [allValue, options, value]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen, selectedLabel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      return options.slice(0, maxVisibleOptions);
    }
    return options
      .filter((option) => normalize(option.label).includes(normalizedQuery))
      .slice(0, maxVisibleOptions);
  }, [maxVisibleOptions, options, query]);

  const totalMatches = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      return options.length;
    }
    return options.filter((option) => normalize(option.label).includes(normalizedQuery)).length;
  }, [options, query]);

  const commitSelection = (nextValue: string) => {
    onChange(nextValue);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      inputRef.current?.blur();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) {
        commitSelection(option.value);
      }
    }
  };

  return (
    <div className="searchable-select" ref={containerRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        autoComplete="off"
        className="searchable-select-input"
        placeholder={placeholder}
        value={isOpen ? query : selectedLabel}
        onFocus={() => {
          setIsOpen(true);
          setQuery('');
          setHighlightedIndex(0);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlightedIndex(0);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <div className="searchable-select-panel" role="listbox">
          <button
            type="button"
            className="searchable-select-option searchable-select-option--all"
            onMouseDown={(event) => {
              event.preventDefault();
              commitSelection(allValue);
            }}
          >
            {allLabel}
          </button>
          {filteredOptions.map((option, index) => (
            <button
              type="button"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={
                index === highlightedIndex
                  ? 'searchable-select-option searchable-select-option--active'
                  : 'searchable-select-option'
              }
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                commitSelection(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div className="searchable-select-empty">Ничего не найдено</div>
          )}
          {totalMatches > filteredOptions.length && (
            <div className="searchable-select-hint">
              Показаны первые {filteredOptions.length} из {totalMatches} — уточните запрос
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
