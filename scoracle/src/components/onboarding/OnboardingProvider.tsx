import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import {
  OnboardingContext,
  type OnboardingContextValue,
} from './onboardingContext'

type TourStep = {
  id: string
  route: string
  targetId: string
  eyebrow: string
  title: string
  body: string
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'mode',
    route: '/',
    targetId: 'mode',
    eyebrow: 'Prediction mode',
    title: 'You are in the scoring seat',
    body: 'When you are signed in, Scoracle switches from fixture browsing to prediction mode so you can enter your Premier League scores.',
  },
  {
    id: 'matchweek',
    route: '/',
    targetId: 'matchweek-selector',
    eyebrow: 'Match week',
    title: 'Pick the week you want to predict',
    body: 'Start with the next open match week, or look back at locked and completed weeks to review your calls.',
  },
  {
    id: 'scores',
    route: '/',
    targetId: 'prediction-card',
    eyebrow: 'Fixtures',
    title: 'Enter home and away scores',
    body: 'Use the score boxes on each fixture card. You can change predictions until kickoff.',
  },
  {
    id: 'save',
    route: '/',
    targetId: 'save-predictions',
    eyebrow: 'Save',
    title: 'Save only when you are ready',
    body: 'Scoracle does not autosave each keystroke. Click Save Predictions to lock in your changed scores for the selected week.',
  },
  {
    id: 'profile',
    route: '/',
    targetId: 'profile-link',
    eyebrow: 'Profile',
    title: 'Track your history',
    body: 'Your profile has your favorite club, avatar, overall rank, and prediction history grouped by match week.',
  },
  {
    id: 'leaderboard',
    route: '/',
    targetId: 'leaderboard-link',
    eyebrow: 'Leaderboard',
    title: 'Climb the table',
    body: 'After real scores are available, Scoracle totals exact scores, great calls, close calls, and weekly points.',
  },
]

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { profile, user, completeOnboarding } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [isManualReplay, setIsManualReplay] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const autoStartedForProfile = useRef<string | null>(null)

  const activeStep = TOUR_STEPS[activeStepIndex]

  const openTour = useCallback(() => {
    setIsManualReplay(true)
    setActiveStepIndex(0)
    setIsOpen(true)
  }, [])

  useEffect(() => {
    if (
      !user ||
      !profile ||
      !profile.onboarding_required ||
      autoStartedForProfile.current === profile.id
    ) {
      return
    }

    autoStartedForProfile.current = profile.id
    setIsManualReplay(false)
    setActiveStepIndex(0)
    setIsOpen(true)
  }, [profile, user])

  useEffect(() => {
    if (!isOpen || !activeStep || location.pathname === activeStep.route) {
      return
    }

    navigate(activeStep.route)
  }, [activeStep, isOpen, location.pathname, navigate])

  useEffect(() => {
    if (!isOpen || !activeStep) {
      return
    }

    let animationFrameId = 0

    function updateSpotlight() {
      const target = document.querySelector(
        `[data-tour-id="${activeStep.targetId}"]`,
      )

      if (!target) {
        setSpotlightRect(null)
        return
      }

      target.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      })

      animationFrameId = window.requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect()
        setSpotlightRect(rect.width > 8 && rect.height > 8 ? rect : null)
      })
    }

    updateSpotlight()
    window.addEventListener('resize', updateSpotlight)
    window.addEventListener('scroll', updateSpotlight, true)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', updateSpotlight)
      window.removeEventListener('scroll', updateSpotlight, true)
    }
  }, [activeStep, isOpen, location.pathname])

  const finishTour = useCallback(async () => {
    setIsCompleting(true)

    try {
      if (!isManualReplay && profile?.onboarding_required) {
        await completeOnboarding()
      }

      setIsOpen(false)
    } finally {
      setIsCompleting(false)
    }
  }, [completeOnboarding, isManualReplay, profile?.onboarding_required])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        void finishTour()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [finishTour, isOpen])

  const value = useMemo<OnboardingContextValue>(() => ({ openTour }), [openTour])

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {isOpen && activeStep ? (
        <OnboardingOverlay
          activeStep={activeStep}
          activeStepIndex={activeStepIndex}
          isCompleting={isCompleting}
          spotlightRect={spotlightRect}
          onBack={() => setActiveStepIndex((index) => Math.max(0, index - 1))}
          onNext={() =>
            setActiveStepIndex((index) =>
              Math.min(TOUR_STEPS.length - 1, index + 1),
            )
          }
          onFinish={finishTour}
        />
      ) : null}
    </OnboardingContext.Provider>
  )
}

function OnboardingOverlay({
  activeStep,
  activeStepIndex,
  isCompleting,
  spotlightRect,
  onBack,
  onNext,
  onFinish,
}: {
  activeStep: TourStep
  activeStepIndex: number
  isCompleting: boolean
  spotlightRect: DOMRect | null
  onBack: () => void
  onNext: () => void
  onFinish: () => void
}) {
  const isFirstStep = activeStepIndex === 0
  const isLastStep = activeStepIndex === TOUR_STEPS.length - 1
  const cardStyle = getTourCardStyle(spotlightRect)

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#12163F]/55 backdrop-blur-[2px]" />

      {spotlightRect ? (
        <div
          className="pointer-events-none fixed rounded-lg border-2 border-[#18D6C9] shadow-[0_0_0_9999px_rgba(18,22,63,0.48),0_18px_48px_rgba(24,214,201,0.28)] transition-all duration-200"
          style={{
            left: Math.max(8, spotlightRect.left - 8),
            top: Math.max(8, spotlightRect.top - 8),
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
          }}
        />
      ) : null}

      <section
        className="fixed w-[min(calc(100vw-32px),390px)] rounded-lg border border-[#DCD5FF] bg-white p-4 text-[#12163F] shadow-[0_24px_80px_rgba(18,22,63,0.30)] motion-safe:animate-[modalIn_160ms_ease-out]"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#5B3FFF]">
              {activeStep.eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-black">{activeStep.title}</h2>
          </div>
          <button
            type="button"
            onClick={onFinish}
            disabled={isCompleting}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DCD5FF] text-[#12163F] transition hover:bg-[#F1ECFF] disabled:opacity-60"
            aria-label="Skip onboarding tour"
            title="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm font-medium leading-6 text-[#555B7A]">
          {activeStep.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-[#555B7A]">
            {activeStepIndex + 1} of {TOUR_STEPS.length}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={isFirstStep || isCompleting}
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-[#DCD5FF] bg-white px-3 text-sm font-bold text-[#5B3FFF] transition hover:bg-[#F1ECFF] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={isLastStep ? onFinish : onNext}
              disabled={isCompleting}
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-gradient-to-br from-[#FF2D9A] to-[#8B5CFF] px-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(255,45,154,0.22)] transition hover:brightness-110 disabled:opacity-60"
            >
              {isLastStep ? (
                <>
                  <Check className="h-4 w-4" />
                  Done
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function getTourCardStyle(spotlightRect: DOMRect | null): CSSProperties {
  if (!spotlightRect) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  const gap = 18
  const cardWidth = Math.min(window.innerWidth - 32, 390)
  const cardHeight = 260
  const left = Math.min(
    Math.max(16, spotlightRect.left),
    window.innerWidth - cardWidth - 16,
  )
  const belowTop = spotlightRect.bottom + gap
  const aboveTop = spotlightRect.top - cardHeight - gap
  const top =
    belowTop + cardHeight < window.innerHeight
      ? belowTop
      : Math.max(16, aboveTop)

  return {
    left,
    top,
  }
}
