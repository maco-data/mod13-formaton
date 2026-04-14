import { useState } from 'react';
import Table, { Column } from '../components/Table';
import { useToast } from '../store/ui.store';
import { useParticipants } from '../hooks/useParticipants';
import type { Participant } from '../services/participants.service';
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
  const { showToast }           = useToast();
  const { participants, loading, error, reload } = useParticipants();

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
          onClick={e => { e.stopPropagation(); showToast(`Ver perfil: ${p.name}`); }}
        >
          Ver
        </button>
      ),
    },
  ];

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
          <button className={styles.btnPrimary} onClick={() => showToast('Importar participantes')}>
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
          onRowClick={(participant) => showToast(`Abriendo perfil: ${participant.name}`)}
        />
      </div>
    </div>
  );
}
