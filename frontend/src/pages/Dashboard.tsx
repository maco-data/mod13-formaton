import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import Calendar from '../components/Calendar';
import { useToast } from '../store/ui.store';
import { useCourses } from '../hooks/useCourses';
import { useParticipants } from '../hooks/useParticipants';
import { useCerts } from '../hooks/useCerts';
import { useAuth } from '../hooks/useAuth';
import styles from './Dashboard.module.css';

const BAR_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const BAR_COLORS = ['var(--primary)', 'var(--accent)', 'var(--success)', 'var(--warning)', 'var(--primary)', 'var(--accent)', 'var(--success)'];

interface UpcomingItem {
  id: string;
  day: number;
  title: string;
  time: string;
  enrolled: number;
  color: string;
  mode: string;
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function toCalendarDay(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getDate();
}

function weekdayIndex(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (date.getDay() + 6) % 7;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAdmin, user } = useAuth();
  const { courses, loading: loadingCourses, error: errorCourses } = useCourses();
  const { participants, loading: loadingParticipants, error: errorParticipants } = useParticipants({ enabled: isAdmin });
  const { certs, loading: loadingCerts, error: errorCerts } = useCerts(isAdmin ? undefined : user?.sub);

  const now = new Date();
  const activeCourses = courses.filter((course) => ['scheduled', 'in_progress'].includes(course.status));
  const totalEnrollments = courses.reduce((sum, course) => sum + course.enrolledCount, 0);
  const validCerts = certs.filter((cert) => cert.status === 'valid').length;
  const completedCourses = courses.filter((course) => course.status === 'completed').length;
  const completionRate = courses.length > 0 ? Math.round((completedCourses / courses.length) * 100) : 0;

  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  courses.forEach((course) => {
    const index = weekdayIndex(course.startAt);
    if (index !== null) weekdayCounts[index] += course.enrolledCount;
  });
  const maxWeekdayCount = Math.max(...weekdayCounts, 1);

  const upcoming = [...courses]
    .filter((course) => {
      const start = new Date(course.startAt);
      return !Number.isNaN(start.getTime()) && start >= now;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 5)
    .reduce<UpcomingItem[]>((acc, course, index) => {
      const day = toCalendarDay(course.startAt);
      if (day === null) return acc;

      acc.push({
        id: course.id,
        day,
        title: course.name,
        time: formatDateLabel(course.startAt),
        enrolled: course.enrolledCount,
        color: BAR_COLORS[index % BAR_COLORS.length],
        mode: course.mode,
      });
      return acc;
    }, []);

  const expiringCert = [...certs]
    .filter((cert) => cert.expiresAt)
    .sort((a, b) => new Date(a.expiresAt as string).getTime() - new Date(b.expiresAt as string).getTime())[0];

  const activity = [
    validCerts > 0
      ? {
          icon: '✓',
          color: 'var(--success-light)',
          iconColor: 'var(--success)',
          text: `Hay ${validCerts} certificados vigentes en la plataforma`,
          time: 'Certificaciones',
        }
      : null,
    upcoming[0]
      ? {
          icon: '▶',
          color: 'var(--primary-light)',
          iconColor: 'var(--primary)',
          text: `La próxima sesión es ${upcoming[0].title}`,
          time: upcoming[0].time,
        }
      : null,
    expiringCert
      ? {
          icon: '!',
          color: 'var(--warning-light)',
          iconColor: 'var(--warning)',
          text: `${expiringCert.workshopName} tiene certificados próximos a vencer`,
          time: expiringCert.expiresAt ? formatDateLabel(expiringCert.expiresAt) : 'Próximo vencimiento',
        }
      : null,
    participants.length > 0
      ? {
          icon: '👥',
          color: 'var(--primary-light)',
          iconColor: 'var(--primary)',
          text: `${participants.length} participantes cargados desde backend`,
          time: 'Usuarios',
        }
      : null,
  ].filter(Boolean) as Array<{ icon: string; color: string; iconColor: string; text: string; time: string }>;

  const loading = loadingCourses || (isAdmin && loadingParticipants) || loadingCerts;
  const error = errorCourses || (isAdmin ? errorParticipants : null) || errorCerts;

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        <StatCard value={loading ? '...' : activeCourses.length} label="Formaciones activas" icon="🎓" color="indigo" onClick={() => navigate('/courses')} />
        <StatCard value={loading ? '...' : totalEnrollments} label="Participantes inscritos" icon="👥" color="cyan" onClick={() => navigate('/participants')} />
        <StatCard value={loading ? '...' : validCerts} label="Certificados emitidos" icon="🛡" color="green" onClick={() => navigate('/certifications')} />
        <StatCard value={loading ? '...' : `${completionRate}%`} label="Tasa de finalización" icon="📈" color="amber" onClick={() => navigate('/reports')} />
      </div>

      <div className={styles.midRow}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Actividad de inscripciones</div>
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${styles.tabActive}`}>Derivado</button>
              <button className={styles.tab} onClick={() => navigate('/reports')}>Informes</button>
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.chartSummary}>
              <span className={styles.bigNumber}>{loading ? '...' : totalEnrollments}</span>
              <span className={styles.bigChange}>{loading ? 'Cargando' : `${activeCourses.length} cursos con actividad`}</span>
            </div>
            <div className={styles.bars}>
              {weekdayCounts.map((count, index) => (
                <div key={BAR_LABELS[index]} className={styles.barCol}>
                  <div
                    className={styles.bar}
                    style={{
                      height: `${Math.max(10, Math.round((count / maxWeekdayCount) * 100))}%`,
                      background: count > 0 ? BAR_COLORS[index] : 'var(--primary-light)',
                    }}
                    onClick={() => showToast(`${BAR_LABELS[index]}: ${count} inscripciones acumuladas`)}
                  />
                </div>
              ))}
            </div>
            <div className={styles.barLabels}>
              {BAR_LABELS.map(label => <span key={label}>{label}</span>)}
            </div>
            <div className={styles.miniStats}>
              <div className={styles.miniStat}><span style={{ color: 'var(--primary)' }}>{participants.length}</span><small>Participantes</small></div>
              <div className={styles.miniStat}><span style={{ color: 'var(--success)' }}>{completedCourses}</span><small>Completadas</small></div>
              <div className={styles.miniStat}><span style={{ color: 'var(--warning)' }}>{courses.reduce((sum, course) => sum + course.durationHours, 0)}h</span><small>Horas formativas</small></div>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Próximas sesiones</div>
            <button className={styles.viewAll} onClick={() => navigate('/calendar')}>Ver todo</button>
          </div>
          <div className={styles.cardBody}>
            <Calendar
              year={now.getFullYear()}
              month={now.getMonth()}
              events={upcoming.map(event => ({ day: event.day, title: event.title, color: event.color }))}
              onDayClick={(_, event) => event && showToast(event.title)}
            />
            <div className={styles.upcomingList}>
              {upcoming.slice(0, 3).map(event => (
                <div key={event.id} className={styles.upcomingItem}>
                  <div className={styles.upcomingDot} style={{ background: event.color }} />
                  <div>
                    <div className={styles.upcomingTitle}>{event.title}</div>
                    <div className={styles.upcomingTime}>{event.time} · {event.enrolled} inscritos</div>
                  </div>
                </div>
              ))}
              {!loading && upcoming.length === 0 && (
                <div className={styles.upcomingItem}>
                  <div>
                    <div className={styles.upcomingTitle}>Sin próximas sesiones</div>
                    <div className={styles.upcomingTime}>No hay sesiones futuras registradas por ahora.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.card}>
          <div className={styles.cardHeader}><div className={styles.cardTitle}>Actividad reciente</div></div>
          <div className={styles.activityList}>
            {error && (
              <div className={styles.activityItem}>
                <div className={styles.activityDot} style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>!</div>
                <div className={styles.activityText}>
                  <div>{error}</div>
                  <div className={styles.activityTime}>Error de carga</div>
                </div>
              </div>
            )}
            {!error && activity.map((item) => (
              <div key={`${item.icon}-${item.time}`} className={styles.activityItem}>
                <div className={styles.activityDot} style={{ background: item.color, color: item.iconColor }}>{item.icon}</div>
                <div className={styles.activityText}>
                  <div>{item.text}</div>
                  <div className={styles.activityTime}>{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}><div className={styles.cardTitle}>Acciones rápidas</div></div>
          <div className={styles.cardBody}>
            <div className={styles.qaGrid}>
              {[
                ...(isAdmin
                  ? [
                      { icon: '➕', bg: 'var(--primary-light)', label: 'Nueva formación', sub: 'Crear curso', action: () => navigate('/courses?create=1') },
                      { icon: '👤', bg: 'var(--accent-light)', label: 'Añadir persona', sub: 'Revisar usuarios', action: () => navigate('/participants') },
                      { icon: '📋', bg: 'var(--success-light)', label: 'Ver informes', sub: 'Analítica actual', action: () => navigate('/reports') },
                      { icon: '🏅', bg: 'var(--warning-light)', label: 'Certificados', sub: 'Seguimiento', action: () => navigate('/certifications') },
                    ]
                  : [
                      { icon: '🎓', bg: 'var(--primary-light)', label: 'Explorar cursos', sub: 'Catálogo disponible', action: () => navigate('/courses') },
                      { icon: '📅', bg: 'var(--accent-light)', label: 'Mi calendario', sub: 'Sesiones inscritas', action: () => navigate('/calendar') },
                      { icon: '👤', bg: 'var(--success-light)', label: 'Mi perfil', sub: 'Datos personales', action: () => navigate('/participants') },
                      { icon: '🏅', bg: 'var(--warning-light)', label: 'Mis certificados', sub: 'Histórico personal', action: () => navigate('/certifications') },
                    ])].map((action) => (
                <button key={action.label} className={styles.qaBtn} onClick={action.action}>
                  <div className={styles.qaIcon} style={{ background: action.bg }}>{action.icon}</div>
                  <div><div className={styles.qaLabel}>{action.label}</div><div className={styles.qaSub}>{action.sub}</div></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
