import { UserRole } from '../models/user.model';

const VALID_ROLES: UserRole[] = ['admin', 'manager', 'student'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NormalizedUserInput = {
  email?: string;
  givenName?: string;
  familyName?: string;
  department?: string;
  role?: UserRole;
  active?: boolean;
};

function normalizeString(value?: string): string | undefined {
  return value?.trim();
}

export function normalizeUserInput(input: {
  email?: string;
  givenName?: string;
  familyName?: string;
  department?: string;
  role?: UserRole;
  active?: boolean;
}): NormalizedUserInput {
  return {
    email: input.email?.trim().toLowerCase(),
    givenName: normalizeString(input.givenName),
    familyName: normalizeString(input.familyName),
    department: normalizeString(input.department),
    role: input.role,
    active: input.active,
  };
}

function validateEmail(email?: string): string | null {
  if (!email) return 'email requerido';
  if (!EMAIL_RE.test(email)) return 'email inválido';
  return null;
}

export function validateCreateUserInput(input: NormalizedUserInput): string | null {
  const emailError = validateEmail(input.email);
  if (emailError) return emailError;
  if (!input.givenName) return 'givenName requerido';
  if (!input.familyName) return 'familyName requerido';
  if (!input.department) return 'department requerido';
  if (input.role !== undefined && !VALID_ROLES.includes(input.role)) return 'Rol inválido';
  return null;
}

export function validateUpdateUserInput(input: NormalizedUserInput): string | null {
  if (input.email !== undefined) {
    const emailError = validateEmail(input.email);
    if (emailError) return emailError === 'email requerido' ? 'email no puede estar vacío' : emailError;
  }
  if (input.givenName !== undefined && !input.givenName) return 'givenName no puede estar vacío';
  if (input.familyName !== undefined && !input.familyName) return 'familyName no puede estar vacío';
  if (input.department !== undefined && !input.department) return 'department no puede estar vacío';
  if (input.role !== undefined && !VALID_ROLES.includes(input.role)) return 'Rol inválido';
  if (input.active !== undefined && typeof input.active !== 'boolean') return 'active debe ser boolean';
  return null;
}
