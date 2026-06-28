import { useContext } from 'react'
import { HelpContext } from './helpContext'

export function useHelp() {
  const context = useContext(HelpContext)

  if (!context) {
    throw new Error('useHelp must be used inside HelpProvider')
  }

  return context
}
