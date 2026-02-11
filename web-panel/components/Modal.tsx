import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

const Modal: React.FC<ModalProps> = ({ open, title, onClose, children, footer, wide }) => {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 flex flex-col max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"><X size={20} strokeWidth={2.5} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>{children}</div>
        {footer && <div className="flex justify-end gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-700">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
