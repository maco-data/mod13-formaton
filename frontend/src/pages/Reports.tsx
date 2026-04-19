import { useToast } from '../store/ui.store';
import { useCourses } from '../hooks/useCourses';
import { useParticipants } from '../hooks/useParticipants';
import { useCerts } from '../hooks/useCerts';
import { useAuth } from '../hooks/useAuth';
import styles from './Reports.module.css';

const REPORT_CARDS = [
  { icon:'📈', color:'var(--primary)', bg:'var(--primary-light)', title:'Progreso y participación', desc:'Métricas derivadas de cursos, inscripciones y finalización actual' },
  { icon:'🛡', color:'var(--success)', bg:'var(--success-light)', title:'Cumplimiento normativo', desc:'Certificados vigentes, próximos vencimientos y cobertura' },
  { icon:'💶', color:'var(--warning)', bg:'var(--warning-light)', title:'Carga formativa', desc:'Horas acumuladas, media por curso y capacidad usada' },
];

const WEEK_LABELS = ['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6','Sem 7','Sem 8'];

function weekBucket(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diff = Date.now() - date.getTime();
  const week = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
  if (week < 0 || week > 7) return null;
  return 7 - week;
}

export default function Reports() {
  const { showToast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const { courses, loading: loadingCourses, error: errorCourses } = useCourses();
  const { participants, loading: loadingParticipants, error: errorParticipants } = useParticipants({ enabled: isAdmin && !authLoading });
  const { certs, loading: loadingCerts, error: errorCerts } = useCerts(undefined, { enabled: isAdmin && !authLoading });

  const enrolled = Array.from({ length: 8 }, () => 0);
  const completed = Array.from({ length: 8 }, () => 0);

  courses.forEach((course) => {
    const bucket = weekBucket(course.startAt);
    if (bucket === null) return;
    enrolled[bucket] += course.enrolledCount;
    if (course.status === 'completed') completed[bucket] += course.enrolledCount;
  });

  const maxEnrolled = Math.max(...enrolled, 1);
  const topCourses = [...courses]
    .map((course) => ({
      name: course.name,
      pct: course.capacity > 0 ? Math.round((course.enrolledCount / course.capacity) * 100) : 0,
      enrolled: course.enrolledCount,
    }))
    .sort((a, b) => b.pct - a.pct || b.enrolled - a.enrolled)
    .slice(0, 5);

  const totalHours = courses.reduce((sum, course) => sum + course.durationHours, 0);
  const totalCapacity = courses.reduce((sum, course) => sum + course.capacity, 0);
  const usedCapacity = courses.reduce((sum, course) => sum + course.enrolledCount, 0);
  const validCerts = certs.filter((cert) => cert.status === 'valid').length;
  const activeParticipants = participants.filter((participant) => participant.active).length;
  const loading = loadingCourses || loadingParticipants || loadingCerts;
  const error = errorCourses || errorParticipants || errorCerts;

  const summary = [
    { label:'Total formaciones', value: loading ? '...' : String(courses.length), icon:'🎓' },
    { label:'Horas formativas', value: loading ? '...' : `${totalHours}h`, icon:'⏱' },
    { label:'Capacidad usada', value: loading ? '...' : `${totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0}%`, icon:'💺' },
    { label:'Participantes activos', value: loading ? '...' : String(activeParticipants), icon:'👤' },
    { label:'Certificados vigentes', value: loading ? '...' : String(validCerts), icon:'🛡' },
    { label:'Media por curso', value: loading ? '...' : `${courses.length > 0 ? Math.round(usedCapacity / courses.length) : 0}`, icon:'📊' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.reportTypes}>
        {REPORT_CARDS.map((report) => (
          <div key={report.title} className={styles.reportCard} onClick={() => showToast(`Generando: ${report.title}`)}>
            <div className={styles.reportIcon} style={{ background: report.bg, color: report.color }}>{report.icon}</div>
            <div className={styles.reportTitle}>{report.title}</div>
            <div className={styles.reportDesc}>{report.desc}</div>
            <div className={styles.reportLink} style={{ color: report.color }}>Generar informe →</div>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Participación — últimas 8 semanas</div>
          <div className={styles.cardActions}>
            <div className={styles.legend}>
              <span className={styles.legendDot} style={{ background: 'var(--primary)' }} /> Inscritos
              <span className={styles.legendDot} style={{ background: 'var(--success)', marginLeft:12 }} /> Completados
            </div>
            <button className={styles.btnOutline} onClick={() => showToast('Exportando Excel...')}>📥 Excel</button>
            <button className={styles.btnOutline} onClick={() => showToast('Exportando PDF...')}>📄 PDF</button>
          </div>
        </div>
        <div className={styles.cardBody}>
          {error ? (
            <div className={styles.reportDesc}>{error}</div>
          ) : (
            <div className={styles.barChart}>
              {WEEK_LABELS.map((week, index) => (
                <div key={week} className={styles.barGroup}>
                  <div className={styles.barPair} style={{ height: `${Math.max(18, Math.round((enrolled[index] / maxEnrolled) * 100))}%` }}>
                    <div className={styles.barA} />
                    <div className={styles.barB} style={{ height: `${enrolled[index] > 0 ? Math.round((completed[index] / enrolled[index]) * 100) : 0}%` }} />
                  </div>
                  <div className={styles.barWeek}>{week}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}><div className={styles.cardTitle}>Formaciones por ocupación</div></div>
          <div className={styles.topList}>
            {topCourses.map((course, index) => (
              <div key={course.name} className={styles.topItem}>
                <div className={styles.topRank}>{index + 1}</div>
                <div className={styles.topInfo}>
                  <div className={styles.topName}>{course.name}</div>
                  <div className={styles.topBar}>
                    <div
                      className={styles.topBarFill}
                      style={{ width: `${course.pct}%`, background: index === 0 ? 'var(--primary)' : index === 1 ? 'var(--success)' : 'var(--accent)' }}
                    />
                  </div>
                </div>
                <div className={styles.topPct}>{course.pct}%</div>
              </div>
            ))}
            {!loading && topCourses.length === 0 && (
              <div className={styles.topItem}>
                <div className={styles.topInfo}>
                  <div className={styles.topName}>Sin datos de cursos</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}><div className={styles.cardTitle}>Resumen del período</div></div>
          <div className={styles.summaryGrid}>
            {summary.map((item) => (
              <div key={item.label} className={styles.summaryItem}>
                <span className={styles.summaryIcon}>{item.icon}</span>
                <div className={styles.summaryValue}>{item.value}</div>
                <div className={styles.summaryLabel}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
