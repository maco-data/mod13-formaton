import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from '../components/Calendar';
import { useToast } from '../store/ui.store';
import { useCourses } from '../hooks/useCourses';
import { useAuth } from '../hooks/useAuth';
import participantsService from '../services/participants.service';
import type { Workshop } from '../services/courses.service';
import styles from './CalendarPage.module.css';

interface CalendarSession {
  id: string;
  day: number;
  title: string;
  time: string;
  enrolled: number;
  color: string;
  mode: string;
  location?: string;
  startAt: string;
  endAt: string;
}

const MODE_LABELS: Record<Workshop['mode'], string> = {
  presencial: 'Presencial',
  online: 'Online',
  hibrida: 'Híbrida',
};

const MODE_COLORS: Record<Workshop['mode'], string> = {
  presencial: 'var(--primary)',
  online: 'var(--accent)',
  hibrida: 'var(--success)',
};

function isValidDate(value: string) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function formatMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1));
}

function formatSessionTime(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return startAt;

  const sameDay = start.toDateString() === end.toDateString();
  const formatter = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (sameDay) return `${formatter.format(start)}–${formatter.format(end)}`;

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(start);
}

export default function CalendarPage() {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<CalendarSession | null>(null);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { courses, loading, error, reload } = useCourses();

  useEffect(() => {
    if (!user?.sub || isAdmin) return;
    void participantsService
      .registrations(user.sub)
      .then((response) => {
        setRegisteredIds(
          Array.isArray(response.items)
            ? response.items
                .filter((registration) => registration.status === 'confirmed')
                .map((registration) => registration.workshopId)
            : []
        );
      })
      .catch(() => setRegisteredIds([]));
  }, [isAdmin, user?.sub]);

  const monthSessions = useMemo(
    () =>
      courses
        .filter((course) => {
          if (!isAdmin && !registeredIds.includes(course.id)) return false;
          if (!isValidDate(course.startAt)) return false;
          if (course.status === 'cancelled') return false;
          const start = new Date(course.startAt);
          return start.getFullYear() === currentYear && start.getMonth() === currentMonth;
        })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        .map<CalendarSession>((course) => ({
          id: course.id,
          day: new Date(course.startAt).getDate(),
          title: course.name,
          time: formatSessionTime(course.startAt, course.endAt),
          enrolled: course.enrolledCount,
          color: MODE_COLORS[course.mode] ?? 'var(--primary)',
          mode: MODE_LABELS[course.mode] ?? course.mode,
          location: course.location,
          startAt: course.startAt,
          endAt: course.endAt,
        })),
    [courses, currentMonth, currentYear, isAdmin, registeredIds]
  );

  const calendarEvents = useMemo(
    () => monthSessions.map((session) => ({
      day: session.day,
      title: session.title,
      color: session.color,
    })),
    [monthSessions]
  );

  const selectedStillVisible = selected
    ? monthSessions.find((session) => session.id === selected.id) ?? null
    : null;
  const activeSelection = selectedStillVisible ?? selected;

  const handleDayClick = (day: number) => {
    const found = monthSessions.find((session) => session.day === day);
    if (found) setSelected(found);
    else {
      setSelected(null);
      showToast(`Día ${day} — sin sesiones programadas`);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        {/* Big calendar */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>{formatMonthLabel(currentYear, currentMonth)}</div>
            {isAdmin ? (
              <button className={styles.btnPrimary} onClick={() => navigate('/courses?create=1')}>+ Nueva sesión</button>
            ) : null}
          </div>
          <div className={styles.calBody}>
            <Calendar
              year={currentYear}
              month={currentMonth}
              events={calendarEvents}
              onDayClick={handleDayClick}
              onMonthChange={(year, month) => {
                setCurrentYear(year);
                setCurrentMonth(month);
                setSelected(null);
              }}
              size="full"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          {/* Selected event detail */}
          {activeSelection && (
            <div className={styles.eventDetail} style={{ borderLeft: `4px solid ${activeSelection.color}` }}>
              <div className={styles.eventDetailTitle}>{activeSelection.title}</div>
              <div className={styles.eventDetailMeta}>
                <span>📅 {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(activeSelection.startAt))}</span>
                <span>🕐 {activeSelection.time}</span>
              </div>
              <div className={styles.eventDetailMeta}>
                <span>📍 {activeSelection.mode}</span>
                <span>👥 {activeSelection.enrolled} inscritos</span>
              </div>
              {activeSelection.location ? (
                <div className={styles.eventDetailLocation}>{activeSelection.location}</div>
              ) : null}
              <div className={styles.eventDetailActions}>
                <button className={styles.btnSm} onClick={() => navigate(`/courses?courseId=${activeSelection.id}`)}>Ver detalle</button>
                <button className={styles.btnSmOutline} onClick={() => setSelected(null)}>Cerrar</button>
              </div>
            </div>
          )}

          {/* Agenda list */}
          <div className={styles.card}>
            <div className={styles.cardHeader}><div className={styles.cardTitle}>Agenda del mes</div></div>
            <div className={styles.agendaList}>
              {loading && (
                <div className={styles.emptyState}>Cargando sesiones del backend...</div>
              )}
              {!loading && error && (
                <div className={styles.emptyState}>
                  <div>{error}</div>
                  <button className={styles.btnSmOutline} onClick={() => void reload()}>Reintentar</button>
                </div>
              )}
              {!loading && !error && monthSessions.length === 0 && (
                <div className={styles.emptyState}>
                  <div>No hay sesiones en este mes.</div>
                  {isAdmin ? (
                    <button className={styles.btnSmOutline} onClick={() => navigate('/courses?create=1')}>Crear una sesión</button>
                  ) : null}
                </div>
              )}
              {!loading && !error && monthSessions.map(ev => (
                <div
                  key={ev.id}
                  className={`${styles.agendaItem} ${activeSelection?.id === ev.id ? styles.agendaActive : ''}`}
                  onClick={() => setSelected(ev)}
                >
                  <div className={styles.agendaDate} style={{ background: activeSelection?.id === ev.id ? ev.color : 'var(--primary-light)', color: activeSelection?.id === ev.id ? 'white' : 'var(--primary)' }}>
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
