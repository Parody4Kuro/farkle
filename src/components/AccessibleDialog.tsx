import { useEffect, useRef, type ReactNode, type SyntheticEvent } from 'react'

interface AccessibleDialogProps {
  ariaLabelledBy: string
  children: ReactNode
  className?: string
  dismissible?: boolean
  onClose?: () => void
}

export function AccessibleDialog({
  ariaLabelledBy,
  children,
  className = '',
  dismissible = true,
  onClose,
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    const focusTarget = dialog.querySelector<HTMLElement>('[data-autofocus]')
    window.setTimeout(() => focusTarget?.focus(), 0)
    return () => {
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close()
        else dialog.removeAttribute('open')
      }
    }
  }, [])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    if (dismissible) onClose?.()
  }

  return (
    <dialog
      ref={dialogRef}
      className={`dialog-shell ${className}`}
      aria-labelledby={ariaLabelledBy}
      onCancel={handleCancel}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose?.()
      }}
    >
      {children}
    </dialog>
  )
}
