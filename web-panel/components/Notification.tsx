import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type NotifType = 'success' | 'error' | 'warn' | 'info';
interface Notif { id: number; message: string; type: NotifType; }
interface NotifCtx { notify: (message: string, type?: NotifType) => void; }

const NotifContext = createContext<NotifCtx>({ notify: () => {} });
export const useNotify = () => useContext(NotifContext);

let _id = 0;
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Notif[]>([]);
  const notify = useCallback((message: string, type: NotifType = 'info') => {
    const id = ++_id;
    setItems(p => [...p, { id, message, type }]);
    setTimeout(() => setItems(p => p.filter(n => n.id !== id)), 3500);
  }, []);

  const dismiss = (id: number) => setItems(p => p.filter(n => n.id !== id));

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" strokeWidth={2} />,
    error: <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" strokeWidth={2} />,
    warn: <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" strokeWidth={2} />,
    info: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" strokeWidth={2} />,
  };
  const colors = {
    success: 'border-green-200 dark:border-green-800/50 bg-white dark:bg-slate-800',
    error: 'border-red-200 dark:border-red-800/50 bg-white dark:bg-slate-800',
    warn: 'border-amber-200 dark:border-amber-800/50 bg-white dark:bg-slate-800',
    info: 'border-blue-200 dark:border-blue-800/50 bg-white dark:bg-slate-800',
  };
  const textColors = {
    success: 'text-green-700 dark:text-green-300',
    error: 'text-red-700 dark:text-red-300',
    warn: 'text-amber-700 dark:text-amber-300',
    info: 'text-blue-700 dark:text-blue-300',
  };

  return (
    <NotifContext.Provider value={{ notify }}>
      {children}
      <div className="fixed top-4 right-4 z-[2000] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {items.map(n => (
          <div key={n.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg shadow-slate-900/5 dark:shadow-slate-900/30 animate-fade-in ${colors[n.type]}`}>
            {icons[n.type]}
            <span className={`text-sm font-medium flex-1 ${textColors[n.type]}`}>{n.message}</span>
            <button onClick={() => dismiss(n.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0 mt-0.5">
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>
    </NotifContext.Provider>
  );
};
