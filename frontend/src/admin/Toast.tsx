import { useState, useEffect } from 'react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

type Listener = (toasts: Toast[]) => void

// Simple singleton event bus for toasts
let _toasts: Toast[] = []
const _listeners: Set<Listener> = new Set()

function notify() {
  _listeners.forEach(l => l([..._toasts]))
}

export function showToast(message: string, type: Toast['type'] = 'success') {
  const id = Math.random().toString(36).slice(2)
  _toasts = [..._toasts, { id, message, type }]
  notify()
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id)
    notify()
  }, 4000)
}

const TOAST_CLASSES: Record<Toast['type'], string> = {
  success: 'bg-ink text-white',
  error: 'bg-danger text-white',
  info: 'bg-accent text-on-accent',
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    _listeners.add(setToasts)
    return () => { _listeners.delete(setToasts) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex w-full items-center gap-2 rounded-btn px-4 py-3 text-sm font-medium shadow-lift animate-fade-up sm:w-auto ${TOAST_CLASSES[toast.type]}`}
        >
          {toast.type === 'success' && <span aria-hidden="true">&#10003;</span>}
          {toast.type === 'error' && <span aria-hidden="true">&#10005;</span>}
          {toast.type === 'info' && <span aria-hidden="true">&#8505;</span>}
          {toast.message}
        </div>
      ))}
    </div>
  )
}
