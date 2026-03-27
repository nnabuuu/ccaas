import { Toaster } from 'sonner'

export interface ChatInterfaceToasterProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}

export function ChatInterfaceToaster({ position = 'top-right' }: ChatInterfaceToasterProps) {
  return <Toaster position={position} richColors />
}
