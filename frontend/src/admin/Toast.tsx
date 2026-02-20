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

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    _listeners.add(setToasts)
    return () => { _listeners.delete(setToasts) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white pointer-events-auto flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300 ${
            toast.type === 'success' ? 'bg-gray-900' :
            toast.type === 'error' ? 'bg-red-600' :
            'bg-blue-600'
          }`}
        >
          {toast.type === 'success' && <span>&#10003;</span>}
          {toast.type === 'error' && <span>&#10005;</span>}
          {toast.type === 'info' && <span>&#8505;</span>}
          {toast.message}
        </div>
      ))}
    </div>
  )
}
