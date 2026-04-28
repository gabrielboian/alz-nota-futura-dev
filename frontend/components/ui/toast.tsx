import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning';

interface ToastProps {
  variant: ToastVariant;
  message: string;
  className?: string;
  onClose?: () => void;
}

const variantConfig = {
  success: {
    outlineColor: 'outline-success',
    textColor: 'text-success',
    iconColor: 'text-success',
    Icon: CheckCircle,
  },
  error: {
    outlineColor: 'outline-error',
    textColor: 'text-error',
    iconColor: 'text-error',
    Icon: AlertCircle,
  },
  warning: {
    outlineColor: 'outline-warning',
    textColor: 'text-warning',
    iconColor: 'text-warning',
    Icon: AlertTriangle,
  },
};

/**
 * Toast notification component for displaying success, error, and warning messages
 *
 * @example
 * <Toast variant="success" message="Operação realizada com sucesso!" />
 * <Toast variant="error" message="Erro ao processar solicitação" />
 * <Toast variant="warning" message="Atenção: verifique os dados" />
 */
export function Toast({ variant, message, className = '', onClose }: ToastProps) {
  const config = variantConfig[variant];
  const Icon = config.Icon;

  return (
    <div
      className={`py-2 bg-white rounded-lg outline outline-1 outline-offset-[-1px] ${config.outlineColor} inline-flex flex-col justify-center items-start gap-2 overflow-hidden ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="self-stretch px-4 inline-flex justify-start items-center gap-2">
        <div className="w-6 h-6 relative flex items-center justify-center flex-shrink-0">
          <Icon className={`w-5 h-5 ${config.iconColor}`} strokeWidth={2} />
        </div>
        <div className={`flex-1 text-sm font-normal font-['Inter'] leading-5 ${config.textColor}`}>
          {message}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`ml-2 ${config.textColor} hover:opacity-70 transition-opacity`}
            aria-label="Fechar notificação"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
