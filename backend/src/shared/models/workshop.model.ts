export type WorkshopStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type WorkshopMode   = 'presencial' | 'online' | 'hibrida';

export interface Workshop {
  PK: string;           // WORKSHOP#<id>
  SK: 'META';
  id: string;
  name: string;
  description: string;
  category: string;
  mode: WorkshopMode;
  location?: string;
  startAt: string;      // ISO 8601
  endAt: string;
  durationHours: number;
  capacity: number;
  enrolledCount: number;
  status: WorkshopStatus;
  generatesCert: boolean;
  certNorm?: string;    // Ej: "ISO 45001", "Fundae", "Ley 31/1995"
  instructorId?: string;
  createdAt: string;
  updatedAt: string;
  // GSI keys
  GSI1PK: 'WORKSHOP#ALL';
  GSI1SK: string;       // startAt para ordenar por fecha
  GSI2PK?: string;      // CATEGORY#<cat>
  GSI2SK?: string;      // startAt
}

export type CreateWorkshopInput = Omit<Workshop,
  'PK' | 'SK' | 'id' | 'enrolledCount' | 'createdAt' | 'updatedAt' | 'GSI1PK' | 'GSI1SK' | 'GSI2PK' | 'GSI2SK'
>;

export type UpdateWorkshopInput = Partial<CreateWorkshopInput>;
