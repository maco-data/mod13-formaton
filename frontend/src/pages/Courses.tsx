import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CourseCard from '../components/CourseCard';
import Modal from '../components/Modal';
import { useToast } from '../store/ui.store';
import { useCourses } from '../hooks/useCourses';
import { useAuth } from '../hooks/useAuth';
import { useCerts } from '../hooks/useCerts';
import participantsService from '../services/participants.service';
import type { CreateWorkshopPayload, Workshop } from '../services/courses.service';
import coursesService from '../services/courses.service';
import type { UserRegistration } from '../services/participants.service';
import styles from './Courses.module.css';

interface RegistrationItem {
  userId: string;
  status: string;
  registeredAt: string;
  certIssued?: boolean;
  userName?: string;
  userEmail?: string;
}

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'scheduled', label: 'Activas' },
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
  const [editingCourse, setEditingCourse] = useState<Workshop | null>(null);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Workshop | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<UserRegistration[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [issuingCertFor, setIssuingCertFor] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast }             = useToast();
  const { user, isAdmin }         = useAuth();
  const { issue: issueCert }      = useCerts(undefined, { enabled: false });
  const { courses, loading, error, create, update, remove, reload } = useCourses(
    filter === 'all' ? undefined : { status: filter }
  );
  const safeCourses = Array.isArray(courses) ? courses : [];

  const visible = safeCourses
    .filter((course) => {
      if (isAdmin) return true;
      return course.status === 'scheduled';
    })
    .filter((course) => {
      const text = search.trim().toLowerCase();
      if (!text) return true;
      return (
        course.name.toLowerCase().includes(text) ||
        course.category.toLowerCase().includes(text) ||
        (course.description ?? '').toLowerCase().includes(text)
      );
    });

  const handleCreate = async (payload: CreateWorkshopPayload) => {
    try {
      await create(payload);
      showToast('Formación creada correctamente');
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const handleUpdate = async (payload: CreateWorkshopPayload) => {
    if (!editingCourse) return;

    try {
      await update(editingCourse.id, payload);
      showToast('Formación actualizada correctamente');
      setEditingCourse(null);
      setModalOpen(false);
      await reload();
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const handleRegister = async (courseId: string) => {
    try {
      setRegisteringId(courseId);
      await coursesService.register(courseId);
      showToast('Inscripción realizada correctamente');
      if (user?.sub) {
        const response = await participantsService.registrations(user.sub);
        setMyRegistrations(Array.isArray(response.items) ? response.items : []);
      }
      await reload();
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setRegisteringId(null);
    }
  };

  const openCourseDetail = async (course: Workshop) => {
    setSelectedCourse(course);

    if (!isAdmin) {
      setRegistrations([]);
      return;
    }

    try {
      setDetailLoading(true);
      const response = await coursesService.getRegistrations(course.id);
      const rawItems = Array.isArray(response?.items) ? response.items as RegistrationItem[] : [];
      const hydratedItems = await Promise.all(
        rawItems.map(async (item) => {
          try {
            const participant = await participantsService.get(item.userId);
            return {
              ...item,
              userName: participant.fullName || `${participant.givenName} ${participant.familyName}`.trim(),
              userEmail: participant.email,
            };
          } catch {
            return item;
          }
        })
      );
      setRegistrations(hydratedItems);
    } catch (err) {
      setRegistrations([]);
      showToast((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeCourseDetail = () => {
    setSelectedCourse(null);
    setRegistrations([]);
    setDetailLoading(false);
    setIssuingCertFor(null);
  };

  const isRegistered = (courseId: string) =>
    myRegistrations.some((registration) => registration.workshopId === courseId && registration.status === 'confirmed');

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleIssueCert = async (registration: RegistrationItem) => {
    if (!selectedCourse) return;

    try {
      setIssuingCertFor(registration.userId);
      await issueCert({
        userId: registration.userId,
        workshopId: selectedCourse.id,
      });
      setRegistrations((current) =>
        current.map((item) =>
          item.userId === registration.userId
            ? { ...item, certIssued: true }
            : item
        )
      );
      showToast('Certificado emitido correctamente');
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setIssuingCertFor(null);
    }
  };

  const handleDeleteCourse = async () => {
    if (!selectedCourse) return;
    const confirmed = window.confirm(`Se cancelará la formación "${selectedCourse.name}" y se notificará a los inscritos. ¿Deseas continuar?`);
    if (!confirmed) return;

    try {
      await remove(selectedCourse.id);
      showToast('Formación cancelada y notificación en proceso');
      closeCourseDetail();
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get('search') ?? '');
    if (params.get('create') === '1') {
      if (isAdmin) {
        setEditingCourse(null);
        setModalOpen(true);
      } else {
        showToast('Solo los administradores pueden crear formaciones');
      }
      params.delete('create');
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [isAdmin, location.pathname, location.search, navigate, showToast]);

  useEffect(() => {
    if (!user?.sub) return;
    if (isAdmin) return;

    void participantsService
      .registrations(user.sub)
      .then((response) => setMyRegistrations(Array.isArray(response.items) ? response.items : []))
      .catch(() => setMyRegistrations([]));
  }, [isAdmin, user?.sub]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedCourseId = params.get('courseId');
    if (!requestedCourseId || safeCourses.length === 0) return;

    const requestedCourse = safeCourses.find((course) => course.id === requestedCourseId);
    if (!requestedCourse) return;

    void openCourseDetail(requestedCourse);
    params.delete('courseId');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate, safeCourses]);

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
              {f.key === 'all' ? ` (${safeCourses.length})` : ''}
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
              onClick={() => void openCourseDetail(c)}
              actionLabel={!isAdmin && user?.role === 'student' ? (isRegistered(c.id) ? 'Inscrito' : 'Inscribirme') : undefined}
              actionDisabled={
                isRegistered(c.id) ||
                registeringId === c.id ||
                c.status !== 'scheduled' ||
                c.enrolledCount >= c.capacity
              }
              onAction={() => void handleRegister(c.id)}
            />
          ))}
        </div>
      ) : null}

      {isAdmin ? (
        <Modal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingCourse(null);
          }}
          onSubmit={editingCourse ? handleUpdate : handleCreate}
          initialValues={editingCourse}
          title={editingCourse ? 'Editar formación' : 'Nueva formación'}
        />
      ) : null}

      {selectedCourse && (
        <div className={styles.overlay} onClick={(event) => {
          if (event.target === event.currentTarget) closeCourseDetail();
        }}>
          <div className={styles.detailModal}>
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.detailEyebrow}>{selectedCourse.category}</div>
                <h2>{selectedCourse.name}</h2>
              </div>
              <div className={styles.detailHeaderActions}>
                {isAdmin && selectedCourse.status !== 'cancelled' && selectedCourse.status !== 'completed' ? (
                  <button
                    className={styles.issueBtn}
                    onClick={() => {
                      setEditingCourse(selectedCourse);
                      setModalOpen(true);
                    }}
                  >
                    Editar formación
                  </button>
                ) : null}
                {isAdmin && selectedCourse.status !== 'cancelled' && selectedCourse.status !== 'completed' ? (
                  <button className={styles.deleteBtn} onClick={() => void handleDeleteCourse()}>
                    Cancelar formación
                  </button>
                ) : null}
                <button className={styles.closeBtn} onClick={closeCourseDetail}>✕</button>
              </div>
            </div>

            <div className={styles.detailBody}>
              <div className={styles.detailGrid}>
                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>Modalidad</div>
                  <div className={styles.detailValue}>{formatMode(selectedCourse.mode)}</div>
                </div>
                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>Fechas</div>
                  <div className={styles.detailValue}>{formatDate(selectedCourse.startAt)}</div>
                  <div className={styles.detailMeta}>hasta {formatDate(selectedCourse.endAt)}</div>
                </div>
                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>Capacidad</div>
                  <div className={styles.detailValue}>{selectedCourse.enrolledCount} / {selectedCourse.capacity}</div>
                  <div className={styles.detailMeta}>inscritos</div>
                </div>
                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>Certificación</div>
                  <div className={styles.detailValue}>{selectedCourse.generatesCert ? 'Sí' : 'No'}</div>
                  <div className={styles.detailMeta}>{selectedCourse.certNorm ?? 'Sin normativa asociada'}</div>
                </div>
              </div>

              <div className={styles.descriptionCard}>
                <div className={styles.detailLabel}>Descripción</div>
                <p>{selectedCourse.description || 'Esta formación todavía no tiene descripción detallada.'}</p>
                <div className={styles.detailMeta}>
                  {selectedCourse.location ? `Ubicación: ${selectedCourse.location}` : 'Ubicación por definir'}
                </div>
              </div>

              {isAdmin && (
                <div className={styles.descriptionCard}>
                  <div className={styles.detailLabel}>Inscripciones</div>
                  {detailLoading ? (
                    <p>Cargando participantes inscritos...</p>
                  ) : registrations.length > 0 ? (
                    <div className={styles.registrationList}>
                      {registrations.map((registration) => (
                        <div key={`${registration.userId}-${registration.registeredAt}`} className={styles.registrationItem}>
                          <div>
                            <div className={styles.registrationUser}>{registration.userName ?? registration.userId}</div>
                            {registration.userEmail ? (
                              <div className={styles.detailMeta}>{registration.userEmail}</div>
                            ) : null}
                            <div className={styles.detailMeta}>{formatDate(registration.registeredAt)}</div>
                          </div>
                          <div className={styles.registrationActions}>
                            <div className={styles.registrationStatus}>
                              {registration.status}
                              {registration.certIssued ? ' · certificado emitido' : ''}
                            </div>
                            {selectedCourse.generatesCert && !registration.certIssued && registration.status === 'confirmed' ? (
                              <button
                                className={styles.issueBtn}
                                onClick={() => void handleIssueCert(registration)}
                                disabled={issuingCertFor === registration.userId}
                              >
                                {issuingCertFor === registration.userId ? 'Emitiendo...' : 'Emitir certificado'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Aún no hay participantes inscritos en esta formación.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
