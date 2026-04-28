/**
 * Centralized toast helpers (PT-BR default language is honored by message text).
 * Use these for transient notifications where the user does NOT need to retry.
 * For retryable errors inside modals, keep the error inline in the modal.
 */
import { toast, type ToastOptions } from 'react-toastify';
import { getErrorMessage } from './errors';

const baseOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 4000,
};

export const notify = {
  success: (message: string, options?: ToastOptions) =>
    toast.success(message, { ...baseOptions, ...options }),
  error: (err: unknown, fallback?: string, options?: ToastOptions) =>
    toast.error(getErrorMessage(err, fallback), { ...baseOptions, ...options }),
  info: (message: string, options?: ToastOptions) =>
    toast.info(message, { ...baseOptions, ...options }),
  warning: (message: string, options?: ToastOptions) =>
    toast.warning(message, { ...baseOptions, ...options }),
};
