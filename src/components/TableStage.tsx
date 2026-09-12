import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { DiceTable } from './DiceTable'
import type { SceneProps } from '../scene/sceneTypes'

const TavernScene = lazy(() => import('../scene/TavernScene'))

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch { return false }
}

export function TableStage(props: Omit<SceneProps, 'onUnavailable'>) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [supported, setSupported] = useState(supportsWebGL)
  const fail = useCallback(() => {
    props.presentation.setReady(false)
    setSupported(false)
  }, [props.presentation])
  const { state } = props
  const { paused } = useSyncExternalStore(props.presentation.playback.subscribe, props.presentation.playback.getSnapshot, props.presentation.playback.getSnapshot)
  const canSelect = !paused && state.currentPlayer === 'human' && state.phase === 'selecting' && !state.doubledSelection
  useEffect(() => {
    // The roll button disappears when results arrive. Keep keyboard navigation
    // with the new controls instead of leaving its starting point below them.
    if (canSelect && document.activeElement === document.body) {
      stageRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed]')?.focus({ preventScroll: true })
    }
  }, [canSelect])
  const fallback = (
    <div className="table-fallback">
      <DiceTable rolledDice={state.rolledDice} lockedDice={state.lockedDice} diceToRoll={state.diceToRoll}
        phase={state.phase} humanTurn={!paused && state.currentPlayer === 'human'} isRolling={state.phase === 'rolling'}
        selectionValid={props.selectionValid} onToggleDie={props.onToggleDie} />
    </div>
  )
  return (
    <div ref={stageRef} className={'table-stage-wrap' + (!supported ? ' using-fallback' : '')}>
      {supported
        ? <SceneBoundary fallback={fallback} onError={fail}><Suspense fallback={fallback}><TavernScene {...props} onUnavailable={fail} /></Suspense></SceneBoundary>
        : fallback}
      {!supported && <span className="fallback-label">简约桌面模式</span>}
    </div>
  )
}
