import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminAuthState {
  adminToken: string | null
  adminId: number | null
  adminName: string
  adminRole: string  // 'staff' | 'super_admin'
  adminPermissions: Record<string, boolean>
  setAdminAuth: (token: string, id: number, name: string, role: string, permissions: Record<string, boolean>) => void
  adminLogout: () => void
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      adminToken: null,
      adminId: null,
      adminName: '',
      adminRole: '',
      adminPermissions: {},
      setAdminAuth: (adminToken, adminId, adminName, adminRole, adminPermissions) =>
        set({ adminToken, adminId, adminName, adminRole, adminPermissions }),
      adminLogout: () => set({ adminToken: null, adminId: null, adminName: '', adminRole: '', adminPermissions: {} }),
    }),
    { name: 'admin-auth' }
  )
)
