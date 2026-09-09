import React from 'react'
import { OrçamentoStatus } from '@/types'

interface StatusBadgeProps {
  status: OrçamentoStatus | string
  className?: string
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  rascunho: {
    label: 'Rascunho',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500',
  },
  enviado: {
    label: 'Enviado',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-600',
  },
  aprovado: {
    label: 'Aprovado',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-600',
  },
  rejeitado: {
    label: 'Rejeitado',
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-600',
  },
  cancelado: {
    label: 'Cancelado',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-600',
  },
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status.toLowerCase()] || {
    label: status,
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-500',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-transparent ${config.bg} ${config.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}
