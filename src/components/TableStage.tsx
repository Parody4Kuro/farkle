import { Component, lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
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
  const [supported, setSupported] = useState(supportsWebGL)
  const fail = useCallback(() => {
    props.presentation.setReady(false)
    setSupported(false)
  }, [props.presentation])
  const { state } = props
  const fallback = (
    <div className="table-fallback">
      <DiceTable rolledDice={state.rolledDice} lockedDice={state.lockedDice} diceToRoll={state.diceToRoll}
        phase={state.phase} humanTurn={state.currentPlayer === 'human'} isRolling={state.phase === 'rolling'}
        selectionValid={props.selectionValid} onToggleDie={props.onToggleDie} />
    </div>
  )
  return (
    <div className={'table-stage-wrap' + (!supported ? ' using-fallback' : '')}>
      {supported
        ? <SceneBoundary fallback={fallback} onError={fail}><Suspense fallback={fallback}><TavernScene {...props} onUnavailable={fail} /></Suspense></SceneBoundary>
        : fallback}
      {!supported && <span className="fallback-label">简约桌面模式</span>}
    </div>
  )
}
