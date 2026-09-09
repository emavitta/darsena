import type { ObjectDirective } from 'vue'

declare module 'vue' {
  interface GlobalDirectives {
    vTooltip: ObjectDirective<HTMLElement, string | undefined>
  }
}

export {}
