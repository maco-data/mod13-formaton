import { useState } from 'react';
import styles from './Calendar.module.css';

interface CalEvent {
  day: number;
  title: string;
  color?: string;
}

interface Props {
  year?: number;
  month?: number; // 0-indexed
  events?: CalEvent[];
  onDayClick?: (day: number, event?: CalEvent) => void;
  size?: 'mini' | 'full';
}

const DAYS   = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Calendar({ year: initYear, month: initMonth, events = [], onDayClick, size = 'mini' }: Props) {
  const now = new Date();
  const [year, setYear]   = useState(initYear  ?? now.getFullYear());
  const [month, setMonth] = useState(initMonth ?? now.getMonth());

  const firstDay  = new Date(year, month, 1).getDay(); // 0=Sun
  const offset    = firstDay === 0 ? 6 : firstDay - 1; // Mon-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isToday   = (d: number) => d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  const getEvent  = (d: number) => events.find(e => e.day === d);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className={`${styles.cal} ${size === 'full' ? styles.full : ''}`}>
      <div className={styles.header}>
        <button className={styles.nav} onClick={prev}>‹</button>
        <span className={styles.monthLabel}>{MONTHS[month]} {year}</span>
        <button className={styles.nav} onClick={next}>›</button>
      </div>

      <div className={styles.grid}>
        {DAYS.map(d => <div key={d} className={styles.dayLabel}>{d}</div>)}

        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ev  = getEvent(day);
          const today = isToday(day);
          return (
            <div
              key={day}
              className={`${styles.day} ${today ? styles.today : ''} ${ev ? styles.hasEvent : ''}`}
              onClick={() => onDayClick?.(day, ev)}
              title={ev?.title}
            >
              {day}
              {ev && !today && (
                <div className={styles.dot} style={{ background: ev.color ?? 'var(--primary)' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
