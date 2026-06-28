import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { AppErrorBoundary } from './app/AppErrorBoundary'
import { AppRoutes } from './app/AppRoutes'
import { queryClient } from './app/queryClient'
import { OnboardingProvider } from './components/onboarding/OnboardingProvider'
import { AuthProvider } from './context/AuthContext'
import { HelpProvider } from './features/help/HelpProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <HelpProvider>
              <OnboardingProvider>
                <AppRoutes />
              </OnboardingProvider>
            </HelpProvider>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
