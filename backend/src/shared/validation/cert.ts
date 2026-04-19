import { IssueCertInput } from '../models/cert.model';

function isInvalidDate(value: string): boolean {
  return Number.isNaN(new Date(value).getTime());
}

export function validateIssueCertInput(input: IssueCertInput): string | null {
  if (!input.userId?.trim()) return 'userId requerido';
  if (!input.workshopId?.trim()) return 'workshopId requerido';

  if (input.score !== undefined) {
    if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
      return 'score debe ser un número entre 0 y 100';
    }
  }

  if (input.expiresAt !== undefined) {
    if (!input.expiresAt.trim()) return 'expiresAt no puede estar vacío';
    if (isInvalidDate(input.expiresAt)) return 'expiresAt debe ser una fecha ISO 8601 válida';
  }

  return null;
}
