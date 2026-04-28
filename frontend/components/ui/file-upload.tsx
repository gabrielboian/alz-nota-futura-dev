'use client';

import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
  label?: string;
  disabled?: boolean;
}

/**
 * File upload component with drag-and-drop support
 *
 * @example
 * <FileUpload
 *   onFilesSelected={(files) => console.log(files)}
 *   accept=".xml,.pdf,.png,.jpg,.jpeg"
 *   multiple
 * />
 */
export function FileUpload({
  onFilesSelected,
  accept = '.xml,.pdf,.png,.jpg,.jpeg',
  multiple = true,
  className = '',
  label,
  disabled = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleClick() {
    fileInputRef.current?.click();
  }

  return (
    <div
      className={`w-full py-2 bg-white rounded-lg outline-1 -outline-offset-1 ${
        isDragging ? 'outline-orange-500 bg-orange-50' : 'outline-orange-300'
      } flex flex-col justify-start items-start gap-2.5 overflow-hidden transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
      onDragEnter={disabled ? undefined : handleDragEnter}
      onDragLeave={disabled ? undefined : handleDragLeave}
      onDragOver={disabled ? undefined : handleDragOver}
      onDrop={disabled ? undefined : handleDrop}
      onClick={disabled ? undefined : handleClick}
    >
      <div className="self-stretch px-6 inline-flex justify-start items-center gap-4">
        <div className="w-5 h-5 relative overflow-hidden flex items-center justify-center">
          <Upload className="w-3.5 h-4 text-slate-900" strokeWidth={2} />
        </div>
        <div className="flex justify-start items-start">
          <div className="text-sm font-normal">
            <span className="text-orange-300 font-semibold underline">
              Clique aqui
            </span>
            <span className="text-slate-900">
              {' '}ou arraste {label || 'arquivos XML, PDF, PNG, JPG ou JPEG'}
            </span>
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        disabled={disabled}
        className="hidden"
      />
    </div>
  );
}
