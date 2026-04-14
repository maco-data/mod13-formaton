import { useState } from 'react';
import { useToast } from '../store/ui.store';
import type { CreateWorkshopPayload } from '../services/courses.service';
import styles from './Modal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (payload: CreateWorkshopPayload) => Promise<void>;
}

export default function Modal({ isOpen, onClose, onSubmit }: Props) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', category: '', mode: 'presencial', location: '',
    startAt: '', endAt: '', durationHours: '', capacity: '',
    description: '', cert: 'obligatorio',
  });

  if (!isOpen) return null;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const resetForm = () => {
    setForm({ name:'', category:'', mode:'presencial', location:'', startAt:'', endAt:'', durationHours:'', capacity:'', description:'', cert:'obligatorio' });
  };

  const handleSave = async () => {
    const durationHours = Number(form.durationHours);
    const capacity = Number(form.capacity);

    if (!form.name || !form.category || !form.startAt || !form.endAt || !durationHours || !capacity) {
      showToast('Completa los campos obligatorios');
      return;
    }

    const payload: CreateWorkshopPayload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      mode: form.mode as CreateWorkshopPayload['mode'],
      location: form.location.trim() || undefined,
      startAt: form.startAt,
      endAt: form.endAt,
      durationHours,
      capacity,
      generatesCert: form.cert !== 'ninguno',
    };

    try {
      setSubmitting(true);
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        showToast('Formación creada correctamente');
      }
      resetForm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Nueva formación</h2>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.group}>
            <label>Nombre de la formación *</label>
            <input type="text" value={form.name} onChange={set('name')} placeholder="Ej: PRL Nivel Básico 2026" />
          </div>

          <div className={styles.row}>
            <div className={styles.group}>
              <label>Categoría *</label>
              <select value={form.category} onChange={set('category')}>
                <option value="">Seleccionar...</option>
                <option>Prevención de Riesgos</option>
                <option>Habilidades Digitales</option>
                <option>Liderazgo</option>
                <option>Calidad e ISO</option>
                <option>Onboarding</option>
                <option>Cumplimiento Normativo</option>
              </select>
            </div>
            <div className={styles.group}>
              <label>Modalidad</label>
              <select value={form.mode} onChange={set('mode')}>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
                <option value="hibrida">Híbrida</option>
              </select>
            </div>
          </div>

          <div className={styles.group}>
            <label>Lugar (opcional)</label>
            <input type="text" value={form.location} onChange={set('location')} placeholder="Ej: Sala A — Planta 2" />
          </div>

          <div className={styles.row}>
            <div className={styles.group}>
              <label>Fecha inicio *</label>
              <input type="datetime-local" value={form.startAt} onChange={set('startAt')} />
            </div>
            <div className={styles.group}>
              <label>Fecha fin</label>
              <input type="datetime-local" value={form.endAt} onChange={set('endAt')} />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.group}>
              <label>Duración (horas)</label>
              <input type="number" value={form.durationHours} onChange={set('durationHours')} placeholder="8" min="1" />
            </div>
            <div className={styles.group}>
              <label>Plazas máximas</label>
              <input type="number" value={form.capacity} onChange={set('capacity')} placeholder="25" min="1" />
            </div>
          </div>

          <div className={styles.group}>
            <label>Descripción</label>
            <textarea value={form.description} onChange={set('description')} rows={3} placeholder="Contenido y objetivos de la formación..." />
          </div>

          <div className={styles.group}>
            <label>Certificado</label>
            <div className={styles.radios}>
              {['obligatorio', 'opcional', 'ninguno'].map(v => (
                <label key={v} className={styles.radio}>
                  <input type="radio" name="cert" value={v} checked={form.cert === v} onChange={set('cert')} />
                  {v === 'obligatorio' ? 'Sí, obligatorio' : v === 'opcional' ? 'Sí, opcional' : 'No genera certificado'}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose}>Cancelar</button>
          <button className={styles.btnSave} onClick={() => void handleSave()} disabled={submitting}>
            {submitting ? 'Guardando...' : 'Guardar formación'}
          </button>
        </div>
      </div>
    </div>
  );
}
