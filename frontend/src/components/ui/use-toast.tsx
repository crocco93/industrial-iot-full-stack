import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

let toastCounter = 0;

const toastState: ToastState = {
  toasts: []
};

const listeners: Array<(state: ToastState) => void> = [];

function dispatch(action: { type: string; toast?: Toast; id?: string }) {
  switch (action.type) {
    case 'ADD_TOAST':
      if (action.toast) {
        toastState.toasts = [...toastState.toasts, action.toast];
      }
      break;
    case 'REMOVE_TOAST':
      toastState.toasts = toastState.toasts.filter(t => t.id !== action.id);
      break;
    case 'CLEAR_TOASTS':
      toastState.toasts = [];
      break;
  }
  
  listeners.forEach(listener => listener(toastState));
}

export function useToast() {
  const [state, setState] = useState<ToastState>(toastState);

  useState(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  });

  const toast = useCallback(
    ({
      title,
      description,
      variant = 'default',
      duration = 5000,
    }: {
      title: string;
      description?: string;
      variant?: 'default' | 'destructive';
      duration?: number;
    }) => {
      const id = (++toastCounter).toString();
      
      const toastItem: Toast = {
        id,
        title,
        description,
        variant,
        duration,
      };

      dispatch({ type: 'ADD_TOAST', toast: toastItem });

      if (duration > 0) {
        setTimeout(() => {
          dispatch({ type: 'REMOVE_TOAST', id });
        }, duration);
      }

      return {
        id,
        dismiss: () => dispatch({ type: 'REMOVE_TOAST', id }),
        update: (updates: Partial<Toast>) => {
          const updatedToast = { ...toastItem, ...updates };
          dispatch({ type: 'REMOVE_TOAST', id });
          dispatch({ type: 'ADD_TOAST', toast: updatedToast });
        }
      };
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id });
  }, []);

  return {
    toasts: state.toasts,
    toast,
    dismiss,
  };
}
