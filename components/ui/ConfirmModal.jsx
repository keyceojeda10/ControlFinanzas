'use client'

import { Modal } from './Modal'

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmColor = 'red',
  onConfirm,
  onCancel,
}) {
  const btnColors = {
    red: 'bg-red-600 hover:bg-red-700 text-white',
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
  }
  const color = btnColors[confirmColor] ?? btnColors.red

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message}</p>
      )}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${color}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
