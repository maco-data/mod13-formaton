import { useState } from 'react';
import Table, { Column } from '../components/Table';
import { useToast } from '../store/ui.store';
import { useParticipants } from '../hooks/useParticipants';
import participantsService, { type CreateParticipantPayload, type Participant } from '../services/participants.service';
import { useAuth } from '../hooks/useAuth';
import styles from './Participants.module.css';

const STATUS: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Activo',      cls: 'green' },
  completed: { label: 'Administrador',  cls: 'blue' },
  pending:   { label: 'Responsable',   cls: 'amber' },
  inactive:  { label: 'Inactivo',    cls: 'gray' },
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

export default function Participants() {
  const [search, setSearch]     = useState('');
  const [dept, setDept]         = useState('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState<CreateParticipantPayload>({
    email: '',
    givenName: '',
    familyName: '',
    department: '',
    role: 'student',
  });
  const { showToast }           = useToast();
  const { isAdmin } = useAuth();
  const { participants, loading, error, create, reload } = useParticipants();

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
    .filter(p => dept === 'Todos' || p.dept === dept)
    .filter(p => !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    );

  const columns: Column<ParticipantRow>[] = [
    {
      key: 'name', header: 'Participante',
      render: p => (
        <div className={styles.userCell}>
          <div className={styles.avatar} style={{ background: p.color }}>
            {p.name.split(' ').map((part: string) => part[0]).join('').slice(0,2)}
          </div>
          <div>
            <div className={styles.userName}>{p.name}</div>
            <div className={styles.userEmail}>{p.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'dept', header: 'Departamento',
      render: p => <span className={styles.deptBadge}>{p.dept}</span>,
    },
    {
      key: 'role', header: 'Rol', width: '150px',
      render: p => <span className={styles.muted}>{p.role}</span>,
    },
    {
      key: 'status', header: 'Estado', width: '110px',
      render: p => {
        const s = STATUS[p.status];
        return <span className={`${styles.badge} ${styles[s.cls]}`}>{s.label}</span>;
      },
    },
    {
      key: 'createdAt', header: 'Alta',
      render: p => <span className={styles.muted}>{p.createdAt}</span>,
    },
    {
      key: 'actions', header: '', width: '80px',
      render: p => (
        <button
          className={styles.btnView}
          onClick={e => {
            e.stopPropagation();
            showToast(`${p.name} · ${p.email} · ${p.dept}`);
          }}
        >
          Ver
        </button>
      ),
    },
  ];

  const setField = (key: keyof CreateParticipantPayload) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
    };

  const resetForm = () => {
    setForm({
      email: '',
      givenName: '',
      familyName: '',
      department: '',
      role: 'student',
    });
  };

  const handleCreate = async () => {
    if (!form.email || !form.givenName || !form.familyName || !form.department) {
      showToast('Completa nombre, apellidos, email y departamento');
      return;
    }

    try {
      setSubmitting(true);
      await create({
        ...form,
        email: form.email.trim(),
        givenName: form.givenName.trim(),
        familyName: form.familyName.trim(),
        department: form.department.trim(),
      });
      resetForm();
      setModalOpen(false);
      showToast('Participante creado correctamente');
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setSubmitting(false);
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

  return (
    <div className={styles.page}>
      <div className={styles.tableCard}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
            />
          </div>

          <select className={styles.select} value={dept} onChange={e => setDept(e.target.value)}>
            {departments.map(d => <option key={d}>{d}</option>)}
          </select>

          <button className={styles.btnOutline} onClick={() => showToast('Exportando participantes...')}>
            Exportar
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => {
              if (!isAdmin) {
                showToast('Solo los administradores pueden añadir participantes');
                return;
              }
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

        {/* Table */}
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
              <h2>Añadir participante</h2>
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
              <button className={styles.btnPrimary} onClick={() => void handleCreate()} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar participante'}
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
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
