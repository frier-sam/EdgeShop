import { useToastStore } from '../store/toastStore'

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={`pointer-events-auto flex min-w-[180px] items-center justify-center gap-2.5 rounded-full px-4 py-3 text-sm font-medium text-white shadow-lift cursor-pointer select-none animate-fade-in ${
            toast.type === 'error' ? 'bg-danger' : toast.type === 'info' ? 'bg-ink-soft' : 'bg-ink'
          }`}
        >
          {toast.type === 'success' && <span aria-hidden="true">✓</span>}
          {toast.type === 'info' && <span aria-hidden="true">✕</span>}
          {toast.type === 'error' && <span aria-hidden="true">!</span>}
          {toast.message}
        </div>
      ))}
    </div>
  )
}
