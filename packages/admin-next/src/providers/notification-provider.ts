import type { NotificationProvider } from '@refinedev/core'
import { toast } from 'sonner'

export const notificationProvider: NotificationProvider = {
  open: ({ type, message, description, key }) => {
    const toastFn = type === 'success' ? toast.success : toast.error
    toastFn(message, { id: key, description })
  },
  close: (key) => {
    toast.dismiss(key)
  },
}
