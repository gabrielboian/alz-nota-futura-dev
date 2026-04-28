import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Ok',
  cancelText = 'Cancelar',
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[454px] bg-white rounded-lg shadow-[0px_4px_8px_0px_rgba(0,0,0,0.09)] inline-flex flex-col justify-start items-start overflow-hidden">
        {/* Icon */}
        <div className="self-stretch py-4 inline-flex justify-center items-center gap-2.5 overflow-hidden">
          <div className="w-14 h-14 p-3 bg-orange-200 rounded-[999px] flex justify-center items-center">
            <AlertTriangle className="w-8 h-8 text-orange-500" strokeWidth={2.5} />
          </div>
        </div>

        {/* Content */}
        <div className="self-stretch px-6 pb-4 flex flex-col justify-start items-center gap-4">
          <div className="flex flex-col justify-start items-center gap-3">
            <div className="text-center justify-center text-slate-900 text-lg font-semibold font-['Inter'] leading-5">
              {title}
            </div>
            <div className="w-80 text-center justify-start text-slate-500 text-base font-normal font-['Inter'] leading-6">
              {message}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="self-stretch px-6 py-4 inline-flex justify-end items-center gap-2">
          {cancelText && (
            <button
              onClick={onCancel}
              className="px-3 py-2 rounded-lg border border-gray-200 flex justify-center items-center gap-2 hover:bg-gray-50 transition-colors"
            >
              <span className="text-slate-900 text-sm font-bold font-['Inter'] leading-6">
                {cancelText}
              </span>
            </button>
          )}
          <button
            onClick={onConfirm}
            className="flex-1 px-3 py-2 bg-primary-hover rounded-lg flex justify-center items-center gap-2 hover:bg-primary-hover transition-colors"
          >
            <span className="text-white text-sm font-bold font-['Inter'] leading-6">
              {confirmText}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
