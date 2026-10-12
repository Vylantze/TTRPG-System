import type { PoolResult } from '@/src/index';

export function HitDiceIcons({ pool }: { pool: PoolResult }) {
  const count = Number.isFinite(pool.capacity) ? Math.min(100, Math.max(0, Math.floor(pool.capacity))) : 0;
  return (
    <span className="hit-dice-icons" role="img" aria-label={`${pool.name}: ${pool.available} of ${pool.capacity} dice remaining`}>
      {Array.from({ length: count }, (_, index) => (
        <svg className={index < pool.available ? 'available' : 'spent'} key={index} aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
          <path d="M12 2 22 7v10l-10 5-10-5V7Z M2 7l10 5 10-5 M12 12v10" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="7" r="1.4" fill="currentColor" />
        </svg>
      ))}
      {pool.capacity > count && <small>{`+${pool.capacity - count}`}</small>}
    </span>
  );
}
