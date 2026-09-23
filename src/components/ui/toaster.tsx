/* Toaster Component - A component that displays a toaster (a component that displays a toast) - from shadcn/ui (exposes Toaster) */
import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        if (!id) return null
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title ? <ToastTitle>{title}</ToastTitle> : null}
              {description ? <ToastDescription>{description}</ToastDescription> : null}
            </div>
            {action || null}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
