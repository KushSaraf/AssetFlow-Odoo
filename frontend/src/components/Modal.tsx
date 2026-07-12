import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[100] animate-in fade-in duration-100">
      <div className="bg-white border border-[#E3E3E6] rounded-sm w-full max-w-lg shadow-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E3E3E6] px-4 py-3 bg-[#F7F7F8]">
          <h3 className="text-sm font-semibold text-[#1F1F1F]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[#6C757D] hover:text-[#1F1F1F] rounded-sm p-0.5 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 text-xs text-[#1F1F1F] leading-relaxed">
          {children}
        </div>

        {/* Footer */}
        {footer !== undefined && (
          <div className="border-t border-[#E3E3E6] px-4 py-3 bg-[#F7F7F8] flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
