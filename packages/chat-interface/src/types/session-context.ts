export interface SessionContext {
  [key: string]: unknown
}

export interface SessionContextConfig {
  chips: SessionContextChip[]
}

export interface SessionContextChip {
  key: string
  label: string
  active?: boolean
}
