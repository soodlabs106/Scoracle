import { useContext } from 'react'
import { OnboardingContext } from './onboardingContext'

export function useOnboarding() {
  const context = useContext(OnboardingContext)

  if (!context) {
    throw new Error('useOnboarding must be used inside OnboardingProvider.')
  }

  return context
}
