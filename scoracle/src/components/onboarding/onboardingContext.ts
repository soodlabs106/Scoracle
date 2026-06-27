import { createContext } from 'react'

export type OnboardingContextValue = {
  openTour: () => void
}

export const OnboardingContext =
  createContext<OnboardingContextValue | null>(null)
