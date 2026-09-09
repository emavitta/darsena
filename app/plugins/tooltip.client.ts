import type { ObjectDirective } from 'vue'

export default defineNuxtPlugin((nuxtApp) => {
  const popup = document.createElement('div')
  popup.id = 'darsena-tooltip'
  popup.className = 'app-tooltip'
  popup.setAttribute('role', 'tooltip')
  popup.setAttribute('popover', 'manual')
  let active: HTMLElement | undefined
  let opening: ReturnType<typeof setTimeout> | undefined
  let closing: ReturnType<typeof setTimeout> | undefined
  const cleanups = new WeakMap<HTMLElement, () => void>()

  function cancelTimers() {
    clearTimeout(opening)
    clearTimeout(closing)
  }
  function describedBy(element: HTMLElement, include: boolean) {
    const ids = (element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
    const next = ids.filter((id) => id !== popup.id)
    if (include) next.push(popup.id)
    if (next.length) element.setAttribute('aria-describedby', next.join(' '))
    else element.removeAttribute('aria-describedby')
  }
  function hide() {
    cancelTimers()
    if (active) describedBy(active, false)
    active = undefined
    if (popup.matches(':popover-open')) popup.hidePopover()
  }
  function position() {
    if (!active) return
    const anchor = active.getBoundingClientRect()
    const bounds = popup.getBoundingClientRect()
    const left = Math.max(
      12,
      Math.min(innerWidth - bounds.width - 12, anchor.left + (anchor.width - bounds.width) / 2),
    )
    const above = anchor.top - bounds.height - 8
    const top = above >= 12 ? above : Math.min(innerHeight - bounds.height - 12, anchor.bottom + 8)
    popup.style.left = `${left}px`
    popup.style.top = `${Math.max(12, top)}px`
  }
  function show(element: HTMLElement) {
    if (!element.isConnected || !element.dataset.tooltip) return
    hide()
    active = element
    // A tooltip inside a modal must also belong to that modal's accessible subtree.
    ;(element.closest('dialog') || document.body).append(popup)
    popup.textContent = element.dataset.tooltip
    popup.showPopover()
    position()
    describedBy(element, true)
  }
  function leave(element?: HTMLElement) {
    clearTimeout(opening)
    clearTimeout(closing)
    if (element && active !== element) return
    closing = setTimeout(() => {
      if (!active?.matches(':focus-visible') && !popup.matches(':hover')) hide()
    }, 160)
  }
  popup.addEventListener('pointerenter', () => clearTimeout(closing))
  popup.addEventListener('pointerleave', () => leave())

  const directive: ObjectDirective<HTMLElement, string | undefined> = {
    mounted(element, binding) {
      element.dataset.tooltip = binding.value || ''
      const enter = (event: PointerEvent) => {
        if (event.pointerType === 'touch') return
        cancelTimers()
        // Nested status hints take precedence over the worktree row's hint.
        if (active !== element) hide()
        opening = setTimeout(() => show(element), 400)
      }
      const exit = () => leave(element)
      const focus = () => {
        // Native popovers restore focus while closing. A tooltip must open
        // after that operation, rather than re-entering the top-layer update.
        queueMicrotask(() => {
          if (document.activeElement === element && element.matches(':focus-visible')) show(element)
        })
      }
      const blur = () => {
        if (active === element) hide()
      }
      element.addEventListener('pointerenter', enter)
      element.addEventListener('pointerleave', exit)
      element.addEventListener('focus', focus)
      element.addEventListener('blur', blur)
      cleanups.set(element, () => {
        element.removeEventListener('pointerenter', enter)
        element.removeEventListener('pointerleave', exit)
        element.removeEventListener('focus', focus)
        element.removeEventListener('blur', blur)
        if (active === element) hide()
      })
    },
    updated(element, binding) {
      element.dataset.tooltip = binding.value || ''
      if (active !== element) return
      if (!binding.value) hide()
      else {
        popup.textContent = binding.value
        position()
      }
    },
    beforeUnmount(element) {
      cleanups.get(element)?.()
      cleanups.delete(element)
    },
  }
  function escape(event: KeyboardEvent) {
    if (event.key === 'Escape' && popup.matches(':popover-open')) {
      hide()
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }
  function outside(event: Event) {
    if (!(event.target instanceof Node) || !popup.contains(event.target)) hide()
  }
  document.addEventListener('keydown', escape, true)
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('scroll', outside, true)
  window.addEventListener('resize', hide)
  window.addEventListener('blur', hide)
  nuxtApp.vueApp.directive('tooltip', directive)
  nuxtApp.vueApp.onUnmount(() => {
    hide()
    popup.remove()
    document.removeEventListener('keydown', escape, true)
    document.removeEventListener('pointerdown', outside, true)
    document.removeEventListener('scroll', outside, true)
    window.removeEventListener('resize', hide)
    window.removeEventListener('blur', hide)
  })
})
