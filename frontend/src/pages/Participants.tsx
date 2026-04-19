import { useEffect, useMemo, useState } from 'react';
import Table, { Column } from '../components/Table';
import { useToast } from '../store/ui.store';
import { useParticipants } from '../hooks/useParticipants';
import participantsService, {
  type CreateParticipantPayload,
  type Participant,
  type UpdateParticipantPayload,
} from '../services/participants.service';
import { useAuth } from '../hooks/useAuth';
import styles from './Participants.module.css';

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'green' },
  completed: { label: 'Administrador', cls: 'blue' },
  pending: { label: 'Responsable', cls: 'amber' },
  inactive: { label: 'Inactivo', cls: 'gray' },
};

interface ParticipantRow {
  id: string;
  name: string;
  email: string;
  dept: string;
  role: Participant['role'];
  status: keyof typeof STATUS;
  createdAt: string;
  color: string;
}

function getAvatarColor(id: string) {
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899', '#14B8A6'];
  return colors[id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length];
}

function formatCreatedAt(value: string) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const EMPTY_FORM: CreateParticipantPayload = {
  email: '',
  givenName: '',
  familyName: '',
  department: '',
  role: 'student',
};

function mergeAuthProfile(user: NonNullable<ReturnType<typeof useAuth>['user']>, profile?: Participant | null): Participant {
  const givenName = profile?.givenName?.trim() || user.givenName?.trim() || '';
  const familyName = profile?.familyName?.trim() || user.familyName?.trim() || '';
  const fullName = profile?.fullName?.trim() || `${givenName} ${familyName}`.trim() || user.email;

  return {
    id: profile?.id || user.sub,
    email: profile?.email?.trim() || user.email,
    givenName,
    familyName,
    fullName,
    department: profile?.department?.trim() || user.department || 'Sin departamento',
    role: profile?.role || user.role,
    active: profile?.active ?? true,
    createdAt: profile?.createdAt || new Date().toISOString(),
  };
}

export default function Participants() {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [selfParticipant, setSelfParticipant] = useState<Participant | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateParticipantPayload>(EMPTY_FORM);
  const { showToast } = useToast();
  const { isAdmin, user } = useAuth();
  const { participants, loading, error, create, update, deactivate, reload } = useParticipants({ enabled: isAdmin });

  const ownParticipant = useMemo(() => {
    if (!user) return null;
    const matchedParticipant = selfParticipant ?? participants.find((participant) => participant.id === user.sub || participant.email === user.email) ?? null;
    return mergeAuthProfile(user, matchedParticipant);
  }, [participants, selfParticipant, user]);
  const ownParticipantName = ownParticipant
    ? ownParticipant.fullName || `${ownParticipant.givenName ?? ''} ${ownParticipant.familyName ?? ''}`.trim() || ownParticipant.email
    : user
      ? `${user.givenName ?? ''} ${user.familyName ?? ''}`.trim() || user.email
      : 'Usuario';

  useEffect(() => {
    if (isAdmin || !user?.sub) return;
    void participantsService
      .get(user.sub)
      .then((participant) => setSelfParticipant(mergeAuthProfile(user, participant)))
      .catch(() => {
        if (!user) return;
        setSelfParticipant(mergeAuthProfile(user));
      });
  }, [isAdmin, user]);

  const rows: ParticipantRow[] = participants.map((participant) => {
    const name = participant.fullName || `${participant.givenName} ${participant.familyName}`.trim() || participant.email;
    const status = !participant.active
      ? 'inactive'
      : participant.role === 'admin'
        ? 'completed'
        : participant.role === 'manager'
          ? 'pending'
          : 'active';

    return {
      id: participant.id,
      name,
      email: participant.email,
      dept: participant.department || 'Sin departamento',
      role: participant.role,
      status,
      createdAt: formatCreatedAt(participant.createdAt),
      color: getAvatarColor(participant.id),
    };
  });

  const departments = ['Todos', ...new Set(rows.map((participant) => participant.dept))];

  const filtered = rows
    .filter((participant) => dept === 'Todos' || participant.dept === dept)
    .filter((participant) => {
      if (!search.trim()) return true;
      const text = search.toLowerCase();
      return participant.name.toLowerCase().includes(text) || participant.email.toLowerCase().includes(text);
    });

  const columns: Column<ParticipantRow>[] = [
    {
      key: 'name',
      header: 'Participante',
      render: (participant) => (
        <div className={styles.userCell}>
          <div className={styles.avatar} style={{ background: participant.color }}>
            {participant.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className={styles.userName}>{participant.name}</div>
            <div className={styles.userEmail}>{participant.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'dept',
      header: 'Departamento',
      render: (participant) => <span className={styles.deptBadge}>{participant.dept}</span>,
    },
    {
      key: 'role',
      header: 'Rol',
      width: '150px',
      render: (participant) => <span className={styles.muted}>{participant.role}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      width: '110px',
      render: (participant) => {
        const status = STATUS[participant.status];
        return <span className={`${styles.badge} ${styles[status.cls]}`}>{status.label}</span>;
      },
    },
    {
      key: 'createdAt',
      header: 'Alta',
      render: (participant) => <span className={styles.muted}>{participant.createdAt}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '150px',
      render: (participant) => (
        <div className={styles.eventDetailActions}>
          <button
            className={styles.btnView}
            onClick={(event) => {
              event.stopPropagation();
              void openParticipantDetail(participant.id);
            }}
          >
            Ver
          </button>
          <button
            className={styles.btnView}
            onClick={(event) => {
              event.stopPropagation();
              const source = participants.find((item) => item.id === participant.id);
              if (!source) return;
              startEditing(source);
            }}
          >
            Editar
          </button>
        </div>
      ),
    },
  ];

  const setField = (key: keyof CreateParticipantPayload) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
    };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEditing = (participant: Participant) => {
    setEditingId(participant.id);
    setForm({
      email: participant.email,
      givenName: participant.givenName,
      familyName: participant.familyName,
      department: participant.department,
      role: participant.role,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.email || !form.givenName || !form.familyName || !form.department) {
      showToast('Completa nombre, apellidos, email y departamento');
      return;
    }

    try {
      setSubmitting(true);

      if (editingId) {
        const payload: UpdateParticipantPayload = {
          email: form.email.trim(),
          givenName: form.givenName.trim(),
          familyName: form.familyName.trim(),
          department: form.department.trim(),
          role: form.role,
        };
        await update(editingId, payload);
        showToast('Participante actualizado correctamente');
      } else {
        await create({
          ...form,
          email: form.email.trim(),
          givenName: form.givenName.trim(),
          familyName: form.familyName.trim(),
          department: form.department.trim(),
        });
        showToast('Participante creado correctamente');
      }

      resetForm();
      setModalOpen(false);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedParticipant || !isAdmin) return;
    if (!selectedParticipant.active) return;

    const confirmed = window.confirm(
      `Se desactivará a ${selectedParticipant.fullName || selectedParticipant.email}. ` +
      'Su ficha seguirá disponible y no se eliminará su histórico. ¿Deseas continuar?'
    );
    if (!confirmed) return;

    try {
      await deactivate(selectedParticipant.id);
      setSelectedParticipant((current) => (current ? { ...current, active: false } : current));
      showToast('Participante desactivado correctamente. El histórico se ha conservado.');
    } catch (err) {
      showToast((err as Error).message);
    }
  };

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

  const openParticipantDetail = async (participantId: string) => {
    try {
      setDetailLoading(true);
      const participant = await participantsService.get(participantId);
      setSelectedParticipant(participant);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.tableCard}>
          <div className={styles.toolbar}>
            <div>
              <div className={styles.userName}>Mi perfil</div>
              <div className={styles.muted}>Consulta tu información personal registrada en la plataforma.</div>
            </div>
          </div>

          {ownParticipant ? (
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Nombre completo</label>
                  <div className={styles.detailBox}>{ownParticipantName}</div>
                </div>
                <div className={styles.formGroup}>
                  <label>Rol</label>
                  <div className={styles.detailBox}>{ownParticipant.role}</div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Email</label>
                <div className={styles.detailBox}>{ownParticipant.email}</div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Departamento</label>
                  <div className={styles.detailBox}>{ownParticipant.department || 'Sin departamento'}</div>
                </div>
                <div className={styles.formGroup}>
                  <label>Estado</label>
                  <div className={styles.detailBox}>{ownParticipant.active ? 'Activo' : 'Inactivo'}</div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Alta en plataforma</label>
                <div className={styles.detailBox}>{formatDate(ownParticipant.createdAt)}</div>
              </div>
            </div>
          ) : (
            <div className={styles.modalBody}>
              <div className={styles.detailBox}>
                No se encontró un perfil ampliado en la base de datos. Tu acceso sigue siendo válido, pero conviene que un administrador complete tu ficha.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.tableCard}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o email..."
            />
          </div>

          <select className={styles.select} value={dept} onChange={(event) => setDept(event.target.value)}>
            {departments.map((department) => <option key={department}>{department}</option>)}
          </select>

          <button className={styles.btnOutline} onClick={() => showToast('Exportación disponible próximamente en CSV.')}>
            Exportar
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
          >
            + Añadir
          </button>
        </div>

        {error && (
          <div className={styles.toolbar}>
            <span className={styles.muted}>{error}</span>
            <button className={styles.btnOutline} onClick={() => void reload()}>Reintentar</button>
          </div>
        )}

        <Table
          columns={columns}
          rows={filtered}
          loading={loading}
          emptyMessage={loading ? 'Cargando participantes...' : 'No hay participantes'}
          onRowClick={(participant) => void openParticipantDetail(participant.id)}
        />
      </div>

      {modalOpen && (
        <div className={styles.overlay} onClick={(event) => {
          if (event.target === event.currentTarget) setModalOpen(false);
        }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{editingId ? 'Editar participante' : 'Añadir participante'}</h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Nombre *</label>
                  <input value={form.givenName} onChange={setField('givenName')} placeholder="Laura" />
                </div>
                <div className={styles.formGroup}>
                  <label>Apellidos *</label>
                  <input value={form.familyName} onChange={setField('familyName')} placeholder="Martínez" />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Correo electrónico *</label>
                <input type="email" value={form.email} onChange={setField('email')} placeholder="laura@empresa.es" />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Departamento *</label>
                  <input value={form.department} onChange={setField('department')} placeholder="Operaciones" />
                </div>
                <div className={styles.formGroup}>
                  <label>Rol</label>
                  <select value={form.role} onChange={setField('role')}>
                    <option value="student">Student</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.btnOutline} onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className={styles.btnPrimary} onClick={() => void handleSave()} disabled={submitting}>
                {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar participante'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(detailLoading || selectedParticipant) && (
        <div className={styles.overlay} onClick={(event) => {
          if (event.target === event.currentTarget) setSelectedParticipant(null);
        }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{detailLoading ? 'Cargando participante...' : 'Detalle del participante'}</h2>
              <button className={styles.closeBtn} onClick={() => setSelectedParticipant(null)}>✕</button>
            </div>

            {!detailLoading && selectedParticipant ? (
              <div className={styles.modalBody}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Nombre completo</label>
                    <div className={styles.detailBox}>{selectedParticipant.fullName || `${selectedParticipant.givenName} ${selectedParticipant.familyName}`.trim()}</div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Rol</label>
                    <div className={styles.detailBox}>{selectedParticipant.role}</div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Email</label>
                  <div className={styles.detailBox}>{selectedParticipant.email}</div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Departamento</label>
                    <div className={styles.detailBox}>{selectedParticipant.department || 'Sin departamento'}</div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Estado</label>
                    <div className={styles.detailBox}>{selectedParticipant.active ? 'Activo' : 'Inactivo'}</div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Alta en plataforma</label>
                  <div className={styles.detailBox}>{formatDate(selectedParticipant.createdAt)}</div>
                </div>

                {!selectedParticipant.active ? (
                  <div className={styles.detailBox}>
                    Este participante está desactivado. Su ficha y su histórico permanecen disponibles para consulta.
                  </div>
                ) : null}

                <div className={styles.modalActions}>
                  <button className={styles.btnOutline} onClick={() => startEditing(selectedParticipant)}>
                    Editar
                  </button>
                  {selectedParticipant.active ? (
                    <button className={styles.btnPrimary} onClick={() => void handleDeactivate()}>
                      Desactivar participante
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
