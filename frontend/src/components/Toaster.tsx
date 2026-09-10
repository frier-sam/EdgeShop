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
          // POD-UI4.md §2.2/§5 A.1 — a Material-style snackbar ground
          // (`inverse-surface`/`inverse-on-surface`) for success/info;
          // `danger` keeps its own red ground so an error toast still
          // reads as an alert rather than a neutral status message.
          className={`pointer-events-auto flex min-w-[180px] items-center justify-center gap-2.5 rounded-pill px-4 py-3 text-sm font-medium shadow-lift cursor-pointer select-none animate-fade-in ${
            toast.type === 'error' ? 'bg-danger text-on-primary' : 'bg-inverse-surface text-inverse-on-surface'
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
