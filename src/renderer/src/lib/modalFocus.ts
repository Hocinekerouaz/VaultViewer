import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogFocus(open: boolean) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const modal = modalRef.current
    if (modal && !modal.contains(document.activeElement)) {
      const first = modal.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? modal).focus()
    }
    return () => {
      const previous = previousRef.current
      previousRef.current = null
      if (previous && document.contains(previous) && previous !== document.activeElement) {
        previous.focus()
      }
    }
  }, [open])

  const onModalKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') return
    const modal = modalRef.current
    if (!modal) return
    const items = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    const inside = active instanceof Node && modal.contains(active)
    if (event.shiftKey) {
      if (!inside || active === first || active === modal) {
        event.preventDefault()
        last.focus()
      }
    } else if (!inside || active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return { modalRef, onModalKeyDown }
}
