export type UserRole = 'admin' | 'manager' | 'student';

export interface User {
  PK: string;        // USER#<id>
  SK: 'META';
  id: string;        // sub de Cognito
  email: string;
  givenName: string;
  familyName: string;
  fullName: string;
  department: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
