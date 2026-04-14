import styles from './CourseCard.module.css';

export interface CourseCardData {
  id: string;
  name: string;
  category: string;
  mode: string;
  durationHours: number;
  enrolledCount: number;
  capacity: number;
  status: string;
  progress?: number;
  icon?: string;
  color?: string;
  bgColor?: string;
}

interface Props {
  course: CourseCardData;
  onClick?: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string; icon: string }> = {
  'Prevención de Riesgos': { color: '#EF4444', bg: '#FEE2E2', icon: '🦺' },
  'Habilidades Digitales':  { color: '#06B6D4', bg: '#ECFEFF', icon: '💻' },
  'Liderazgo':              { color: '#8B5CF6', bg: '#EDE9FE', icon: '🎯' },
  'Calidad e ISO':          { color: '#10B981', bg: '#D1FAE5', icon: '🛡' },
  'Onboarding':             { color: '#F59E0B', bg: '#FEF3C7', icon: '👋' },
  'default':                { color: '#4F46E5', bg: '#EEF2FF', icon: '📚' },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  scheduled:   { label: 'Activa',     cls: 'active' },
  in_progress: { label: 'En curso',   cls: 'active' },
  completed:   { label: 'Completada', cls: 'completed' },
  cancelled:   { label: 'Cancelada',  cls: 'cancelled' },
  draft:       { label: 'Borrador',   cls: 'draft' },
};

export default function CourseCard({ course, onClick, actionLabel, actionDisabled = false, onAction }: Props) {
  const theme = CATEGORY_COLORS[course.category] ?? CATEGORY_COLORS['default'];
  const status = STATUS_LABELS[course.status] ?? { label: course.status, cls: 'draft' };
  const pct = course.capacity > 0 ? Math.round((course.enrolledCount / course.capacity) * 100) : 0;

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.thumb} style={{ background: theme.bg }}>
        <span className={styles.thumbIcon}>{theme.icon}</span>
        <span className={styles.category} style={{ color: theme.color, background: `${theme.bg}`, border: `1px solid ${theme.color}30` }}>
          {course.category}
        </span>
        <span className={styles.duration}>{course.durationHours}h</span>
      </div>

      <div className={styles.body}>
        <div className={styles.title}>{course.name}</div>
        <div className={styles.meta}>
          <span>📍 {course.mode}</span>
          <span>👥 {course.enrolledCount} inscritos</span>
        </div>

        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%`, background: theme.color }} />
        </div>

        <div className={styles.footer}>
          <div className={styles.faces}>
            {['AB','MR','JL'].map((i, idx) => (
              <div key={idx} className={styles.face} style={{ background: `hsl(${240 + idx * 40}, 70%, 60%)` }}>{i}</div>
            ))}
            {course.enrolledCount > 3 && <span className={styles.faceCount}>+{course.enrolledCount - 3}</span>}
          </div>
          <span className={`${styles.status} ${styles[status.cls]}`}>{status.label}</span>
        </div>

        {actionLabel && (
          <button
            className={styles.action}
            disabled={actionDisabled}
            onClick={(event) => {
              event.stopPropagation();
              onAction?.();
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
