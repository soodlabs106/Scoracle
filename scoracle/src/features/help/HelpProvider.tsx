import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { HelpCircle, Search, X } from 'lucide-react'
import { HelpContext } from './helpContext'
import { helpSections } from './helpContent'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function HelpProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const openHelp = useCallback(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null
    setIsOpen(true)
  }, [])

  const closeHelp = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    window.setTimeout(() => returnFocusRef.current?.focus(), 0)
  }, [])

  const visibleSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return helpSections
    }

    return helpSections.filter((section) =>
      [section.title, section.summary, ...section.items, ...section.keywords]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [query])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeHelp()
        return
      }

      if (event.key !== 'Tab' || !dialog) {
        return
      }

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      const first = focusable[0]
      const last = focusable.at(-1)

      if (!first || !last) {
        event.preventDefault()
        return
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeHelp, isOpen])

  return (
    <HelpContext.Provider value={{ openHelp }}>
      {children}
      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#12163F]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeHelp()
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scoracle-help-title"
            className="flex max-h-[92dvh] w-full flex-col rounded-t-lg border border-[#DCD5FF] bg-white shadow-[0_24px_80px_rgba(18,22,63,0.28)] sm:max-w-3xl sm:rounded-lg"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#DCD5FF] bg-gradient-to-r from-[#F1ECFF] to-[#E9FFFC] p-4 sm:p-5">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#5B3FFF] shadow-sm">
                  <HelpCircle aria-hidden="true" />
                </span>
                <div>
                  <h2 id="scoracle-help-title" className="font-heading text-xl font-black text-[#12163F]">
                    Scoracle Help
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[#555B7A]">
                    Predictions, scoring, profile, and leaderboard guidance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeHelp}
                aria-label="Close help"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#DCD5FF] bg-white text-[#12163F] transition hover:bg-[#FFF0F8] focus:outline-none focus:ring-2 focus:ring-[#5B3FFF]"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="border-b border-[#DCD5FF] p-4 sm:px-5">
              <label className="relative block">
                <span className="sr-only">Search help</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5B3FFF]" size={18} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search help"
                  className="h-11 w-full rounded-lg border border-[#DCD5FF] bg-[#F7F5FF] pl-10 pr-3 text-sm font-semibold text-[#12163F] outline-none placeholder:text-[#555B7A] focus:border-[#5B3FFF] focus:ring-2 focus:ring-[#5B3FFF]/15"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {visibleSections.length > 0 ? (
                <div className="space-y-4">
                  {visibleSections.map((section) => (
                    <section key={section.id} className="rounded-lg border border-[#DCD5FF] bg-white p-4">
                      <h3 className="font-heading text-base font-black text-[#5B3FFF]">
                        {section.title}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-[#12163F]">
                        {section.summary}
                      </p>
                      <ul className="mt-3 space-y-2 text-sm font-medium text-[#555B7A]">
                        {section.items.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#18D6C9]" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[#DCD5FF] bg-[#F7F5FF] p-6 text-center text-sm font-semibold text-[#555B7A]">
                  No help topics match “{query}”.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </HelpContext.Provider>
  )
}
