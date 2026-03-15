import * as React from 'react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  /** Pass true when the dialog contains unsaved changes so the user is
   *  asked for confirmation before the dialog closes. */
  isDirty?: boolean
}

export function Dialog({ open, onClose, children, className, isDirty = false }: DialogProps) {
  const [confirmClose, setConfirmClose] = React.useState(false)

  // Keep refs up-to-date so the stable event-listener callback always reads
  // the latest values without being recreated on every render.
  const onCloseRef = React.useRef(onClose)
  const isDirtyRef = React.useRef(isDirty)
  const confirmCloseRef = React.useRef(confirmClose)
  onCloseRef.current = onClose
  isDirtyRef.current = isDirty
  confirmCloseRef.current = confirmClose

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirmCloseRef.current) {
        // Escape dismisses the confirmation (stay open)
        setConfirmClose(false)
      } else if (isDirtyRef.current) {
        setConfirmClose(true)
      } else {
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Reset confirmation state when the dialog is re-opened
  React.useEffect(() => {
    if (open) setConfirmClose(false)
  }, [open])

  if (!open) return null

  function handleBackdropClick() {
    if (confirmCloseRef.current) return // confirmation already showing
    if (isDirtyRef.current) {
      setConfirmClose(true)
    } else {
      onCloseRef.current()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleBackdropClick} />
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl overflow-y-auto max-h-[90vh]',
          className,
        )}
      >
        {children}

        {/* ── Unsaved-changes confirmation overlay ─────────────────────────── */}
        {confirmClose && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm p-6">
            <div className="w-full max-w-xs rounded-xl border bg-card p-5 shadow-lg text-center space-y-3">
              <p className="text-sm font-semibold text-foreground">Alterações não salvas</p>
              <p className="text-xs text-muted-foreground">
                Você tem alterações que ainda não foram salvas. Deseja fechar sem salvar?
              </p>
              <div className="flex gap-2 justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmClose(false)}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  Continuar editando
                </button>
                <button
                  type="button"
                  onClick={() => onCloseRef.current()}
                  className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Fechar sem salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold mb-4', className)}>{children}</h2>
}
