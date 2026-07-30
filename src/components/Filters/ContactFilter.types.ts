import type { ReactNode } from 'react'

interface ContactFilterOption {
  avatar: ReactNode
  isCurrentUser?: boolean
  label: string
  secondaryLabel?: string
  value: string
}

interface ContactFilterProps {
  disabled?: boolean
  loading?: boolean
  onChange: (value: string) => void
  onClear: () => void
  options: ContactFilterOption[]
  value?: string | null
}

export type { ContactFilterOption, ContactFilterProps }
