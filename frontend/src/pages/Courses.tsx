import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CourseCard from '../components/CourseCard';
import Modal from '../components/Modal';
import { useToast } from '../store/ui.store';
import { useCourses } from '../hooks/useCourses';
import { useAuth } from '../hooks/useAuth';
import type { CreateWorkshopPayload, Workshop } from '../services/courses.service';
import coursesService from '../services/courses.service';
import styles from './Courses.module.css';

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'scheduled', label: 'Activas' },
  { key: 'draft', label: 'Borrador' },
  { key: 'completed', label: 'Completadas' },
] as const;

function formatMode(mode: Workshop['mode']) {
  if (mode === 'online') return 'Online';
  if (mode === 'hibrida') return 'Híbrida';
  return 'Presencial';
}

export default function Courses() {
  const [filter, setFilter]       = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch]       = useState('');
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast }             = useToast();
  const { user, isAdmin }         = useAuth();
  const { courses, loading, error, create, reload } = useCourses(
    filter === 'all' ? undefined : { status: filter }
  );

  const visible = courses
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async (payload: CreateWorkshopPayload) => {
    try {
      await create(payload);
      showToast('Formación creada correctamente');
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const handleRegister = async (courseId: string) => {
    try {
      setRegisteringId(courseId);
      await coursesService.register(courseId);
      showToast('Inscripción realizada correctamente');
      await reload();
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setRegisteringId(null);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('create') === '1') {
      setModalOpen(true);
      params.delete('create');
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`${styles.filterTab} ${filter === f.key ? styles.active : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.key === 'all' ? ` (${courses.length})` : ''}
            </button>
          ))}
        </div>

        <div className={styles.right}>
          <div className={styles.search}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar formación..."
            />
          </div>
          {isAdmin ? (
            <button className={styles.btnPrimary} onClick={() => setModalOpen(true)}>
              + Nueva formación
            </button>
          ) : null}
        </div>
      </div>

      {!isAdmin && user?.role === 'student' ? (
        <div className={styles.infoBanner}>
          Estás en modo participante. Desde aquí puedes explorar el catálogo y registrarte en formaciones activas.
        </div>
      ) : null}

      {error && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>⚠</div>
          <div className={styles.emptyText}>{error}</div>
          <button className={styles.btnPrimary} onClick={() => void reload()}>Reintentar</button>
        </div>
      )}

      {!error && visible.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>{loading ? '⏳' : '🔍'}</div>
          <div className={styles.emptyText}>
            {loading ? 'Cargando formaciones...' : 'No hay formaciones que coincidan con tu búsqueda'}
          </div>
        </div>
      ) : !error ? (
        <div className={styles.grid}>
          {visible.map(c => (
            <CourseCard
              key={c.id}
              course={{ ...c, mode: formatMode(c.mode) }}
              onClick={() => showToast(`Abriendo: ${c.name}`)}
              actionLabel={!isAdmin && user?.role === 'student' ? 'Inscribirme' : undefined}
              actionDisabled={
                registeringId === c.id ||
                c.status !== 'scheduled' ||
                c.enrolledCount >= c.capacity
              }
              onAction={() => void handleRegister(c.id)}
            />
          ))}
        </div>
      ) : null}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}
