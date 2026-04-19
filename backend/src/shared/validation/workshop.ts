import { CreateWorkshopInput, UpdateWorkshopInput, Workshop, WorkshopMode, WorkshopStatus } from '../models/workshop.model';

const VALID_MODES: WorkshopMode[] = ['presencial', 'online', 'hibrida'];
const VALID_STATUSES: WorkshopStatus[] = ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'];

function isBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length === 0;
}

function isInvalidDate(value: string | undefined): boolean {
  if (!value) return false;
  return Number.isNaN(Date.parse(value));
}

export function validateCreateWorkshopInput(input: CreateWorkshopInput): string | null {
  if (!input || typeof input !== 'object') return 'Body inválido';

  const requiredFields: Array<keyof CreateWorkshopInput> = [
    'name',
    'category',
    'mode',
    'startAt',
    'endAt',
    'durationHours',
    'capacity',
  ];

  for (const field of requiredFields) {
    const value = input[field];
    if (value === undefined || value === null || isBlank(value)) {
      return 'Campos requeridos: name, category, mode, startAt, endAt, durationHours, capacity';
    }
  }

  return validateWorkshopState({
    ...input,
    generatesCert: input.generatesCert ?? false,
  } as Workshop);
}

export function validateUpdateWorkshopInput(existing: Workshop, updates: UpdateWorkshopInput): string | null {
  if (!updates || typeof updates !== 'object') return 'Body inválido';

  return validateWorkshopState({
    ...existing,
    ...updates,
  });
}

function validateWorkshopState(workshop: Pick<Workshop, 'name' | 'category' | 'mode' | 'startAt' | 'endAt' | 'durationHours' | 'capacity' | 'enrolledCount' | 'status' | 'location'>): string | null {
  if (isBlank(workshop.name)) return 'El nombre es obligatorio';
  if (isBlank(workshop.category)) return 'La categoría es obligatoria';

  if (!VALID_MODES.includes(workshop.mode)) {
    return `mode debe ser uno de: ${VALID_MODES.join(', ')}`;
  }

  if (workshop.status && !VALID_STATUSES.includes(workshop.status)) {
    return `status debe ser uno de: ${VALID_STATUSES.join(', ')}`;
  }

  if (isInvalidDate(workshop.startAt)) return 'startAt debe ser una fecha ISO 8601 válida';
  if (isInvalidDate(workshop.endAt)) return 'endAt debe ser una fecha ISO 8601 válida';
  if (new Date(workshop.startAt).getTime() >= new Date(workshop.endAt).getTime()) {
    return 'startAt debe ser anterior a endAt';
  }

  if (!Number.isFinite(workshop.durationHours) || workshop.durationHours <= 0) {
    return 'durationHours debe ser un número mayor que 0';
  }

  if (!Number.isInteger(workshop.capacity) || workshop.capacity <= 0) {
    return 'capacity debe ser un entero mayor que 0';
  }

  if (workshop.capacity < workshop.enrolledCount) {
    return 'capacity no puede ser menor que enrolledCount';
  }

  if ((workshop.mode === 'presencial' || workshop.mode === 'hibrida') && (!workshop.location || isBlank(workshop.location))) {
    return 'location es obligatoria para talleres presenciales o híbridos';
  }

  return null;
}
