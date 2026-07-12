'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast List Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          let styles = {
            border: 'border-l-4 border-l-[#28A745]',
            icon: <CheckCircle2 size={16} className="text-[#28A745]" />,
          };

          if (t.type === 'error') {
            styles = {
              border: 'border-l-4 border-l-[#DC3545]',
              icon: <AlertTriangle size={16} className="text-[#DC3545]" />,
            };
          } else if (t.type === 'info') {
            styles = {
              border: 'border-l-4 border-l-[#3B82F6]',
              icon: <Info size={16} className="text-[#3B82F6]" />,
            };
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto bg-white border border-[#E3E3E6] rounded-sm p-3 shadow-md flex items-start gap-3 justify-between animate-in slide-in-from-right-4 duration-200 ${styles.border}`}
            >
              <div className="flex gap-2.5 items-start">
                <span className="mt-0.5 shrink-0">{styles.icon}</span>
                <span className="text-xs text-[#1F1F1F] font-medium leading-normal">{t.message}</span>
              </div>
              <button
                onClick={() => remove(t.id)}
                className="text-[#6C757D] hover:text-[#1F1F1F] shrink-0 p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
