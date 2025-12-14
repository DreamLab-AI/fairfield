import { writable, get } from 'svelte/store';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmButtonClass?: string;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((confirmed: boolean) => void) | null;
}

function createConfirmStore() {
  const { subscribe, set, update } = writable<ConfirmState>({
    open: false,
    options: null,
    resolve: null
  });

  return {
    subscribe,

    confirm(options: ConfirmOptions): Promise<boolean> {
      return new Promise((resolve) => {
        set({
          open: true,
          options: {
            confirmLabel: 'Confirm',
            cancelLabel: 'Cancel',
            variant: 'danger',
            ...options
          },
          resolve
        });
      });
    },

    handleConfirm() {
      const state = get({ subscribe });
      if (state.resolve) {
        state.resolve(true);
      }
      set({ open: false, options: null, resolve: null });
    },

    handleCancel() {
      const state = get({ subscribe });
      if (state.resolve) {
        state.resolve(false);
      }
      set({ open: false, options: null, resolve: null });
    },

    close() {
      const state = get({ subscribe });
      if (state.resolve) {
        state.resolve(false);
      }
      set({ open: false, options: null, resolve: null });
    }
  };
}

export const confirmStore = createConfirmStore();

// Convenience function
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return confirmStore.confirm(options);
}
