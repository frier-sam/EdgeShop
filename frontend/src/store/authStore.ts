import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  customerId: number | null
  customerName: string
  setAuth: (token: string, customerId: number, name: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      customerId: null,
      customerName: '',
      setAuth: (token, customerId, customerName) => set({ token, customerId, customerName }),
      logout: () => set({ token: null, customerId: null, customerName: '' }),
    }),
    { name: 'edgeshop-auth' }
  )
)
