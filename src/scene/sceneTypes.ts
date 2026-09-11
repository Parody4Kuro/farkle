import type { GameState } from '../game/types'
import type { GameEvent } from '../game/state'
import type { RollPresentation } from '../presentation/rollPresentation'
import type { OpponentDefinition } from '../game/opponents'
import type { TableView } from './camera'

export interface SceneProps {
  state: GameState
  presentation: RollPresentation
  selectionValid: boolean
  onToggleDie: (id: string) => void
  onUnavailable: () => void
  opponent?: OpponentDefinition
  view?: TableView
  appearance?: 'copper' | 'moon'
}

export interface PresentationEvent {
  sequence: number
  event: GameEvent
}
