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
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-full shadow-lg text-sm font-medium cursor-pointer select-none animate-fade-in"
          style={{
            backgroundColor: toast.type === 'error' ? '#dc2626' : toast.type === 'info' ? '#374151' : '#1a1a1a',
            color: '#fff',
            minWidth: '180px',
            justifyContent: 'center',
          }}
        >
          {toast.type === 'success' && <span>✓</span>}
          {toast.type === 'info' && <span>✕</span>}
          {toast.type === 'error' && <span>!</span>}
          {toast.message}
        </div>
      ))}
    </div>
  )
}
