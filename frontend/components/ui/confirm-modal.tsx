'use client';

import React from 'react';
import { Modal } from './modal';
import { CheckCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

/**
 * Confirmation modal for general actions
 * Uses success/green theme for confirmations
 *
 * @example
 * <ConfirmModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={handleSubmit}
 *   title="Iniciar processamento"
 *   message="Essa ação iniciará o processamento dos documentos selecionados. Deseja continuar?"
 *   confirmText="Continuar"
 *   cancelText="Cancelar"
 * />
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Ação',
  message,
  confirmText = 'Continuar',
  cancelText = 'Cancelar',
  isLoading = false,
}: ConfirmModalProps) {
  function handleConfirm() {
    onConfirm();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      className="max-w-lg"
    >
      <div className="self-stretch inline-flex flex-col justify-start items-start overflow-hidden">
        {/* Icon Section */}
        <div className="self-stretch py-4 inline-flex justify-center items-center gap-2.5 overflow-hidden">
          <div className="w-14 h-14 p-3 bg-success-light rounded-[999px] flex justify-center items-center">
            <div className="w-8 h-8 relative flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-success" strokeWidth={3.4} />
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="self-stretch px-6 pt-2 pb-4 flex flex-col justify-start items-center gap-3">
          <div className="text-center text-text-primary text-lg font-semibold font-['Inter'] leading-5">
            {title}
          </div>
          <div className="self-stretch text-center text-text-secondary text-base font-normal font-['Inter'] leading-6">
            {message}
          </div>
        </div>

        {/* Buttons Section */}
        <div className="self-stretch px-6 py-4 inline-flex justify-end items-center gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded-lg outline-1 -outline-offset-1 outline-border-default flex justify-center items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-brand-blue text-sm font-bold font-['Inter'] leading-6">
              {cancelText}
            </span>
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-brand-blue rounded-lg flex justify-center items-center gap-2 hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-white text-sm font-bold font-['Inter'] leading-6">
                  Processando...
                </span>
              </>
            ) : (
              <span className="text-white text-sm font-bold font-['Inter'] leading-6">
                {confirmText}
              </span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
