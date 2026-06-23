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
      <span className="text-[11px] font-semibold uppercase leading-4 text-[#5f6664] sm:text-xs">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[#DADADA] bg-[#F9F9F9] px-2 text-base font-medium leading-5 text-[#333333] focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
        style={{ fontSize: '16px', fontWeight: 500 }}
        aria-expanded={isOpen}
      >
        {renderSelected ? (
          renderSelected()
        ) : (
          <span className="truncate">{selectedLabel}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-[#5f6664]" />
      </button>

      {isOpen && !disabled ? (
        <div
          className={`absolute z-20 mt-2 max-h-80 ${minMenuWidthClass} overflow-auto rounded-lg border border-[#DADADA] bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.14)] motion-safe:animate-[dropdownIn_140ms_ease-out]`}
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
                  ? 'bg-[#E8F4FA] text-[#333333]'
                  : 'hover:bg-[#F9F9F9]'
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
