'use client'
// components/ui/ConfirmModal.jsx — Diálogo de confirmación canónico.
// Construido sobre Modal + Button (ver DESIGN.md).

import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmColor = 'red', // 'red' | 'blue' | 'green' — mapea a variantes del sistema
  loading = false,
  onConfirm,
  onCancel,
}) {
  const variantMap = {
    red: 'danger',
    blue: 'primary',
    green: 'success',
  }
  const variant = variantMap[confirmColor] ?? 'danger'

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      {message && (
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--cf-ink-2)' }}>
          {message}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={variant} size="sm" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
