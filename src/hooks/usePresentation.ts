import { useLayoutEffect, useSyncExternalStore } from 'react'
import type { RollPresentation } from '../presentation/rollPresentation'
import type { PresentationPreferences } from '../presentation/ActionPlayback'
import { useReducedMotion } from '../scene/useReducedMotion'

const noop = () => () => {}
const empty = () => null
export function usePresentationAction(presentation?: RollPresentation) {
  return useSyncExternalStore(presentation?.actions.subscribe ?? noop, presentation?.actions.getSnapshot ?? empty, empty)
}
export function usePresentationPreferences(presentation: RollPresentation, preferences: PresentationPreferences) {
  const systemReduced = useReducedMotion()
  useLayoutEffect(() => {
    presentation.actions.configure({ ...preferences, reducedMotion: systemReduced || preferences.reducedMotion })
  }, [presentation, preferences, systemReduced])
  useLayoutEffect(() => () => presentation.reset(), [presentation])
}
