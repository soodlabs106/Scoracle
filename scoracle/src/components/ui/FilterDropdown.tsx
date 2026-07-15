import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export type FilterDropdownOption = {
  value: string
  label: string
  disabled?: boolean
}

export function FilterDropdown({
  label,
  selectedValue,
  selectedLabel,
  options,
  isOpen,
  disabled = false,
  minMenuWidthClass = 'min-w-full',
  onOpenChange,
  onSelect,
  renderSelected,
  renderOption,
}: {
  label: string
  selectedValue: string
  selectedLabel: string
  options: FilterDropdownOption[]
  isOpen: boolean
  disabled?: boolean
  minMenuWidthClass?: string
  onOpenChange: (isOpen: boolean) => void
  onSelect: (value: string) => void
  renderSelected?: () => ReactNode
  renderOption?: (option: FilterDropdownOption) => ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onOpenChange(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onOpenChange])

  return (
    <div ref={containerRef} className="relative grid gap-0.5 text-left">
      <span className="text-xs font-bold uppercase leading-4 text-[#555B7A]">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[#DCD5FF] bg-white px-2 text-base font-medium leading-5 text-[#12163F] shadow-sm focus:border-[#5B3FFF] focus:outline-none focus:ring-2 focus:ring-[#5B3FFF]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
        aria-expanded={isOpen}
      >
        {renderSelected ? (
          renderSelected()
        ) : (
          <span className="truncate">{selectedLabel}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-[#5B3FFF]" />
      </button>

      {isOpen && !disabled ? (
        <div
          className={`absolute left-0 top-full z-40 mt-2 max-h-80 ${minMenuWidthClass} origin-top overflow-auto rounded-lg border border-[#DCD5FF] bg-white p-1 shadow-[0_16px_38px_rgba(91,63,255,0.16)] motion-safe:animate-[dropdownIn_140ms_ease-out]`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              onClick={() => {
                if (!option.disabled) {
                  onSelect(option.value)
                  onOpenChange(false)
                }
              }}
              className={`flex w-full items-center rounded-md px-2 py-2 text-left text-[16px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                selectedValue === option.value
                  ? 'bg-[#F1ECFF] text-[#5B3FFF]'
                  : 'text-[#12163F] hover:bg-[#E9FFFC]'
              }`}
            >
              {renderOption ? (
                renderOption(option)
              ) : (
                <span className="truncate">{option.label}</span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
