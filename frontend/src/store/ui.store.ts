import { create } from 'zustand';

interface UIState {
  toastMsg: string;
  toastVisible: boolean;
  showToast: (msg: string) => void;
}

let timer: ReturnType<typeof setTimeout>;

export const useToast = create<UIState>((set) => ({
  toastMsg: '',
  toastVisible: false,
  showToast: (msg) => {
    clearTimeout(timer);
    set({ toastMsg: msg, toastVisible: true });
    timer = setTimeout(() => set({ toastVisible: false }), 2800);
  },
}));
