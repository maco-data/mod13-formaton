import { create } from 'zustand';
import type { Workshop } from '../services/courses.service';

interface CoursesState {
  items: Workshop[];
  loading: boolean;
  error: string | null;
  nextToken?: string;
  setItems:    (items: Workshop[]) => void;
  addItem:     (item: Workshop) => void;
  updateItem:  (id: string, patch: Partial<Workshop>) => void;
  removeItem:  (id: string) => void;
  setLoading:  (v: boolean) => void;
  setError:    (e: string | null) => void;
  setNextToken:(t?: string) => void;
}

export const useCoursesStore = create<CoursesState>((set) => ({
  items: [],
  loading: false,
  error: null,
  nextToken: undefined,

  setItems:     (items)         => set({ items }),
  addItem:      (item)          => set(s => ({ items: [item, ...s.items] })),
  updateItem:   (id, patch)     => set(s => ({ items: s.items.map(w => w.id === id ? { ...w, ...patch } : w) })),
  removeItem:   (id)            => set(s => ({ items: s.items.filter(w => w.id !== id) })),
  setLoading:   (loading)       => set({ loading }),
  setError:     (error)         => set({ error }),
  setNextToken: (nextToken)     => set({ nextToken }),
}));
