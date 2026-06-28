import { createContext } from 'react'

export type HelpContextValue = {
  openHelp: () => void
}

export const HelpContext = createContext<HelpContextValue | null>(null)
