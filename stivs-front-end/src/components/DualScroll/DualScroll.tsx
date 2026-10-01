import React, { useEffect, useRef, useState } from 'react';
import './DualScroll.css';

interface DualScrollProps {
  className?: string;
  children: React.ReactNode;
}

// Horizontal scroll container with a mirrored scrollbar above the content,
// so wide tables can be scrolled without reaching the bottom of the page.
const DualScroll: React.FC<DualScrollProps> = ({ className, children }) => {
  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const measure = () => {
      setScrollWidth(body.scrollWidth);
      setHasOverflow(body.scrollWidth > body.clientWidth + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    Array.from(body.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [children]);

  const sync = (source: HTMLDivElement | null, target: HTMLDivElement | null) => {
    if (source && target && target.scrollLeft !== source.scrollLeft) {
      target.scrollLeft = source.scrollLeft;
    }
  };

  return (
    <>
      <div
        ref={topRef}
        className="dual-scroll-top"
        style={{ display: hasOverflow ? undefined : 'none' }}
        onScroll={() => sync(topRef.current, bodyRef.current)}
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
      <div ref={bodyRef} className={className} onScroll={() => sync(bodyRef.current, topRef.current)}>
        {children}
      </div>
    </>
  );
};

export default DualScroll;
