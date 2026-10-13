import { useId, useState, type ReactNode } from 'react';

/** Immediate hover/focus help, without the browser's native title delay. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId();
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [hidden, setHidden] = useState(false);
  const place = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 232)), top: Math.min(rect.bottom + 6, window.innerHeight - 80) });
    setHidden(false);
  };
  return (
    <span className="tooltip-wrap" tabIndex={0} aria-describedby={id} onMouseEnter={(event) => place(event.currentTarget)} onFocus={(event) => place(event.currentTarget)} onKeyDown={(event) => { if (event.key === 'Escape') setHidden(true); }}>
      {children}
      <span className="tooltip-text" role="tooltip" id={id} hidden={hidden} style={position}>{text}</span>
    </span>
  );
}
