import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from '../components/Calendar';
import { useToast } from '../store/ui.store';
import styles from './CalendarPage.module.css';

const EVENTS = [
  { day:13, title:'PRL Básico',             time:'09:00–13:00', enrolled:18, color:'var(--primary)',  mode:'Presencial' },
  { day:14, title:'Excel Avanzado',          time:'16:00–18:00', enrolled:12, color:'var(--accent)',   mode:'Online' },
  { day:16, title:'Liderazgo y Equipos',     time:'10:00–14:00', enrolled:24, color:'var(--success)',  mode:'Híbrida' },
  { day:21, title:'ISO 45001 Auditor',       time:'09:00–18:00', enrolled: 6, color:'var(--warning)',  mode:'Presencial' },
  { day:24, title:'Onboarding Corporativo',  time:'10:00–13:00', enrolled: 8, color:'var(--primary)',  mode:'Online' },
  { day:28, title:'Comunicación Efectiva',   time:'09:00–17:00', enrolled:15, color:'var(--danger)',   mode:'Presencial' },
];

export default function CalendarPage() {
  const [selected, setSelected]   = useState<typeof EVENTS[0] | null>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleDayClick = (day: number) => {
    const found = EVENTS.find(e => e.day === day);
    if (found) setSelected(found);
    else { setSelected(null); showToast(`Día ${day} — sin sesiones`); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        {/* Big calendar */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Abril 2026</div>
            <button className={styles.btnPrimary} onClick={() => navigate('/courses?create=1')}>+ Nueva sesión</button>
          </div>
          <div className={styles.calBody}>
            <Calendar
              year={2026} month={3}
              events={EVENTS.map(e => ({ day: e.day, title: e.title, color: e.color }))}
              onDayClick={handleDayClick}
              size="full"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          {/* Selected event detail */}
          {selected && (
            <div className={styles.eventDetail} style={{ borderLeft: `4px solid ${selected.color}` }}>
              <div className={styles.eventDetailTitle}>{selected.title}</div>
              <div className={styles.eventDetailMeta}>
                <span>📅 Abr {selected.day}</span>
                <span>🕐 {selected.time}</span>
              </div>
              <div className={styles.eventDetailMeta}>
                <span>📍 {selected.mode}</span>
                <span>👥 {selected.enrolled} inscritos</span>
              </div>
              <div className={styles.eventDetailActions}>
                <button className={styles.btnSm} onClick={() => showToast('Abriendo detalle')}>Ver detalle</button>
                <button className={styles.btnSmOutline} onClick={() => setSelected(null)}>Cerrar</button>
              </div>
            </div>
          )}

          {/* Agenda list */}
          <div className={styles.card}>
            <div className={styles.cardHeader}><div className={styles.cardTitle}>Agenda del mes</div></div>
            <div className={styles.agendaList}>
              {EVENTS.map(ev => (
                <div
                  key={ev.day}
                  className={`${styles.agendaItem} ${selected?.day === ev.day ? styles.agendaActive : ''}`}
                  onClick={() => setSelected(ev)}
                >
                  <div className={styles.agendaDate} style={{ background: selected?.day === ev.day ? ev.color : 'var(--primary-light)', color: selected?.day === ev.day ? 'white' : 'var(--primary)' }}>
                    {ev.day}
                  </div>
                  <div className={styles.agendaInfo}>
                    <div className={styles.agendaTitle}>{ev.title}</div>
                    <div className={styles.agendaMeta}>{ev.time} · {ev.enrolled} inscritos · {ev.mode}</div>
                  </div>
                  <div className={styles.agendaDot} style={{ background: ev.color }} />
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className={styles.card}>
            <div className={styles.cardHeader}><div className={styles.cardTitle}>Modalidades</div></div>
            <div className={styles.legendList}>
              {[
                { label:'Presencial', color:'var(--primary)' },
                { label:'Online',     color:'var(--accent)' },
                { label:'Híbrida',    color:'var(--success)' },
              ].map(l => (
                <div key={l.label} className={styles.legendItem}>
                  <div className={styles.legendDot} style={{ background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
