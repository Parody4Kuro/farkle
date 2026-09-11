import { isGameHidden, onGameVisibilityChange } from '../platform/visibility'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createGameAudio, type GameAudio, type SoundCue } from '../audio/gameAudio'
import { isPresentationEvent } from '../presentation/events'
import type { PresentRoll } from '../presentation/rollPresentation'
import { chooseAiDice, shouldAiContinue } from '../game/ai'
import { rollDice } from '../game/dice'
import {
  applyScoreModifiers,
  canUseModifier,
  findBustProtector,
  getModifier,
  getTurnDiceCount,
} from '../game/modifiers'
import { createInitialState } from '../game/rules'
import { hasAnyScore, validateSelectedDice } from '../game/scoring'
import { gameReducer, type GameEvent } from '../game/state'
import type {
  AudioPreferences,
  GameSettings,
  GameState,
  GameStats,
  ModifierUsage,
} from '../game/types'
import {
  AUDIO_KEY,
  loadAudioPreferences,
  loadSettings,
  loadStats,
  normalizeAudioPreferences,
  normalizeSettings,
  saveStored,
  SETTINGS_KEY,
  STATS_KEY,
  getBrowserStorage,
} from '../storage/gameStorage'

const DEFAULT_DELAYS = {
  roll: 650,
  aiInspect: 750,
  aiSelect: 850,
  aiDecision: 600,
  hotDice: 950,
  betweenRolls: 450,
  bust: 1400,
  handoff: 800,
}

type DelayKey = keyof typeof DEFAULT_DELAYS

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface DiceGameDependencies {
  audio?: GameAudio
  storage?: StorageLike
  random?: () => number
  idFactory?: () => string
  delays?: Partial<Record<DelayKey, number>>
  presentRoll?: PresentRoll
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function fullPlayerLoadout(settings: GameSettings): string[] {
  const diceCount = getTurnDiceCount(settings.modifierIds, 6, 'human')
  return Array.from({ length: diceCount }, (_, index) => settings.dieLoadout[index] ?? 'standard')
}

export function useDiceGame(dependencies: DiceGameDependencies = {}) {
  const presentRoll = dependencies.presentRoll
  const storage = dependencies.storage ?? getBrowserStorage()
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings(storage))
  const [stats, setStats] = useState<GameStats>(() => loadStats(storage))
  const [audioPreferences, setAudioPreferences] = useState<AudioPreferences>(() => loadAudioPreferences(storage))
  const [state, setState] = useState<GameState>(() => createInitialState(settings))
  const [gameStarted, setGameStarted] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  const stateRef = useRef(state)
  const runId = useRef(0)
  const rollAbort = useRef<AbortController | null>(null)
  const rollSequence = useRef(0)
  const eventSequence = useRef(0)
  const [presentationEvent, setPresentationEvent] = useState<{ sequence: number; event: GameEvent } | null>(null)
  const [ownsAudio] = useState(() => !dependencies.audio)
  const [audio] = useState<GameAudio>(() => dependencies.audio ?? createGameAudio(audioPreferences))

  const delayFor = useCallback((key: DelayKey) => (
    dependencies.delays?.[key] ?? DEFAULT_DELAYS[key]
  ), [dependencies.delays])

  const send = useCallback((event: GameEvent): GameState => {
    const next = gameReducer(stateRef.current, event)
    stateRef.current = next
    setState(next)
    if (isPresentationEvent(event)) setPresentationEvent({ sequence: ++eventSequence.current, event })
    return next
  }, [])

  const play = useCallback((cue: SoundCue) => {
    if (!isGameHidden()) audio.play(cue)
  }, [audio])

  const unlockAudio = useCallback(() => {
    void audio.unlock()
  }, [audio])

  const makeRoll = useCallback((definitionIds: string[]) => {
    const random = dependencies.random ?? Math.random
    return dependencies.idFactory
      ? rollDice(definitionIds, definitionIds.length, random, dependencies.idFactory)
      : rollDice(definitionIds, definitionIds.length, random)
  }, [dependencies.idFactory, dependencies.random])

  const animateRoll = useCallback(async (dice: GameState['rolledDice'], player: GameState['currentPlayer'], activeRun: number) => {
    rollAbort.current?.abort()
    const controller = new AbortController()
    rollAbort.current = controller
    const id = ++rollSequence.current
    await new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        stopVisibility()
        controller.signal.removeEventListener('abort', finish)
        controller.abort()
        resolve()
      }
      const visibility = () => { if (isGameHidden()) finish() }
      const timeout = window.setTimeout(finish, 6000)
      controller.signal.addEventListener('abort', finish, { once: true })
      const stopVisibility = onGameVisibilityChange(visibility)
      if (isGameHidden()) { finish(); return }
      try {
        const animation = presentRoll
          ? presentRoll({ id, dice, player, onImpact: (strength) => {
            if (!controller.signal.aborted && activeRun === runId.current && !isGameHidden()) audio.playImpact?.(strength)
          } }, controller.signal)
          : wait(delayFor('roll'))
        void animation.then(finish, finish)
      } catch { finish() }
    })
  }, [audio, delayFor, presentRoll])

  useEffect(() => {
    if (saveStored(storage, SETTINGS_KEY, settings)) return
    const timeout = window.setTimeout(() => setStorageWarning(true), 0)
    return () => window.clearTimeout(timeout)
  }, [settings, storage])

  useEffect(() => {
    if (saveStored(storage, STATS_KEY, stats)) return
    const timeout = window.setTimeout(() => setStorageWarning(true), 0)
    return () => window.clearTimeout(timeout)
  }, [stats, storage])

  useEffect(() => {
    if (saveStored(storage, AUDIO_KEY, audioPreferences)) return
    const timeout = window.setTimeout(() => setStorageWarning(true), 0)
    return () => window.clearTimeout(timeout)
  }, [audioPreferences, storage])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (isGameHidden()) void audio.suspend()
      else if (audioPreferences.enabled) void audio.unlock()
    }
    return onGameVisibilityChange(onVisibilityChange)
  }, [audio, audioPreferences.enabled])

  useEffect(() => () => {
    runId.current += 1
    rollAbort.current?.abort()
    if (ownsAudio) void audio.dispose()
  }, [audio, ownsAudio])

  const selectedDice = useMemo(
    () => state.rolledDice.filter((die) => die.selected),
    [state.rolledDice],
  )
  const selection = useMemo(
    () => validateSelectedDice(selectedDice.map((die) => die.value)),
    [selectedDice],
  )
  const modifiedSelectionScore = selection.valid
    ? applyScoreModifiers(state.config.modifierIds, selection.score, 'human')
    : selection.score
  const selectedScore = modifiedSelectionScore * (state.doubledSelection ? 2 : 1)

  const recordHumanTurn = useCallback((turnScore: number, rollStreak: number, won: boolean) => {
    setStats((current) => ({
      ...current,
      wins: current.wins + (won ? 1 : 0),
      highestTurnScore: Math.max(current.highestTurnScore, turnScore),
      longestRollStreak: Math.max(current.longestRollStreak, rollStreak),
    }))
  }, [])

  const beginHumanTurn = useCallback((turnNumber: number) => {
    send({ type: 'BEGIN_TURN', player: 'human', turnNumber })
  }, [send])

  const runAiTurn = useCallback(async (
    startingScores: GameState['scores'],
    turnNumber: number,
    config: GameSettings,
    usage: ModifierUsage,
    activeRun: number,
  ) => {
    let scores = startingScores
    let turnScore = 0
    let definitionIds = Array<string>(6).fill('standard')

    stateRef.current = {
      ...stateRef.current,
      scores,
      config,
      modifierUsage: usage,
    }
    send({ type: 'BEGIN_TURN', player: 'ai', turnNumber })

    while (activeRun === runId.current) {
      play('roll')
      send({ type: 'ROLL_STARTED', diceCount: definitionIds.length, message: `酒馆老板掷出 ${definitionIds.length} 颗骰子……` })
      const rolled = makeRoll(definitionIds)
      await animateRoll(rolled, 'ai', activeRun)
      if (activeRun !== runId.current) return
      const canScore = hasAnyScore(rolled.map((die) => die.value))
      send({
        type: 'ROLL_RESOLVED',
        dice: rolled,
        nextPhase: canScore ? 'ai_thinking' : 'bust',
        message: canScore ? '酒馆老板正在端详这次点数……' : '对手爆骰！本回合分数全部丢失。',
      })
      if (!canScore) {
        play('bust')
        send({ type: 'BUST', dice: rolled, message: '对手爆骰！本回合分数全部丢失。' })
        await wait(delayFor('bust'))
        if (activeRun !== runId.current) return
        beginHumanTurn(turnNumber + 1)
        return
      }

      await wait(delayFor('aiInspect'))
      if (activeRun !== runId.current) return

      const choice = chooseAiDice(rolled.map((die) => die.value))
      const chosen = rolled
        .filter((_, index) => choice.indices.includes(index))
        .map((die) => ({ ...die, selected: true }))
      const remaining = rolled.filter((_, index) => !choice.indices.includes(index))
      const hotDice = remaining.length === 0

      send({
        type: 'SHOW_SELECTION',
        dice: rolled.map((die, index) => ({ ...die, selected: choice.indices.includes(index) })),
        message: `酒馆老板留下 ${chosen.length} 颗计分骰，获得 ${choice.score} 分。`,
      })
      await wait(delayFor('aiSelect'))
      if (activeRun !== runId.current) return

      turnScore += choice.score
      const nextCount = hotDice ? 6 : remaining.length
      send({
        type: 'LOCK_SELECTION',
        keptDice: chosen,
        score: choice.score,
        nextDiceCount: nextCount,
        hotDice,
        message: hotDice ? 'HOT DICE！对手获得一整把新骰子。' : '酒馆老板正在权衡风险……',
      })
      play(hotDice ? 'hot-dice' : 'lock')
      await wait(delayFor(hotDice ? 'hotDice' : 'aiDecision'))
      if (activeRun !== runId.current) return

      const continueRolling = shouldAiContinue({
        difficulty: config.aiDifficulty,
        turnScore,
        remainingDice: nextCount,
        aiScore: scores.ai,
        humanScore: scores.human,
        targetScore: config.targetScore,
        hotDice,
      })

      if (!continueRolling) {
        const next = send({
          type: 'BANK',
          player: 'ai',
          turnTotal: turnScore,
          message: `酒馆老板保存了 ${turnScore} 分。`,
          winningMessage: `酒馆老板保存 ${turnScore} 分并赢下了这局。`,
        })
        scores = next.scores
        play(next.winner === 'ai' ? 'defeat' : 'bank')
        if (next.winner === 'ai') {
          setStats((current) => ({ ...current, losses: current.losses + 1 }))
          return
        }
        await wait(delayFor('handoff'))
        if (activeRun !== runId.current) return
        beginHumanTurn(turnNumber + 1)
        return
      }

      definitionIds = hotDice
        ? Array<string>(6).fill('standard')
        : remaining.map((die) => die.definitionId)
      send({ type: 'SET_MESSAGE', message: '酒馆老板决定继续冒险……', phase: 'ai_thinking', hotDice: false })
      await wait(delayFor('betweenRolls'))
    }
  }, [animateRoll, beginHumanTurn, delayFor, makeRoll, play, send])

  const startAi = useCallback((snapshot: GameState) => {
    const activeRun = ++runId.current
    void runAiTurn(
      snapshot.scores,
      snapshot.turnNumber,
      snapshot.config,
      snapshot.modifierUsage,
      activeRun,
    )
  }, [runAiTurn])

  const handleHumanBust = useCallback(async (
    rolled: GameState['rolledDice'],
    definitionIds: string[],
    activeRun: number,
    afterRoll: GameState,
  ) => {
    const protector = findBustProtector(afterRoll.config.modifierIds, afterRoll.modifierUsage)
    play('bust')
    if (protector?.useLimit) {
      send({ type: 'SET_MESSAGE', message: '幸运护符生效！这次爆骰被免除，骰子将重新投出。', phase: 'bust' })
      send({ type: 'MARK_MODIFIER_USED', modifierId: protector.id, scope: protector.useLimit.scope })
      await wait(delayFor('hotDice'))
      if (activeRun !== runId.current) return

      play('roll')
      send({ type: 'ROLL_STARTED', diceCount: definitionIds.length, message: '护符让骰子重新滚动……' })
      const rerolled = makeRoll(definitionIds)
      await animateRoll(rerolled, 'human', activeRun)
      if (activeRun !== runId.current) return
      const canScore = hasAnyScore(rerolled.map((die) => die.value))
      const next = send({
        type: 'ROLL_RESOLVED',
        dice: rerolled,
        nextPhase: canScore ? 'selecting' : 'bust',
        countPlayerRoll: true,
        message: canScore ? '护符奏效了。请选择计分骰。' : '爆骰！护符已经耗尽，本回合得分丢失。',
      })
      if (canScore) return

      play('bust')
      const busted = send({ type: 'BUST', dice: rerolled, message: '爆骰！护符已经耗尽，本回合得分丢失。' })
      setStats((current) => ({
        ...current,
        longestRollStreak: Math.max(current.longestRollStreak, next.rollStreak),
      }))
      await wait(delayFor('bust'))
      if (activeRun === runId.current) startAi(busted)
      return
    }

    const busted = send({ type: 'BUST', dice: rolled, message: '爆骰！本回合得分丢失。' })
    setStats((current) => ({
      ...current,
      longestRollStreak: Math.max(current.longestRollStreak, afterRoll.rollStreak),
    }))
    await wait(delayFor('bust'))
    if (activeRun === runId.current) startAi(busted)
  }, [animateRoll, delayFor, makeRoll, play, send, startAi])

  const performHumanRoll = useCallback(async (definitionIds: string[]) => {
    const activeRun = ++runId.current
    play('roll')
    send({ type: 'ROLL_STARTED', diceCount: definitionIds.length, message: `正在掷出 ${definitionIds.length} 颗骰子……` })
    const rolled = makeRoll(definitionIds)
    await animateRoll(rolled, 'human', activeRun)
    if (activeRun !== runId.current) return
    const canScore = hasAnyScore(rolled.map((die) => die.value))
    const afterRoll = send({
      type: 'ROLL_RESOLVED',
      dice: rolled,
      nextPhase: canScore ? 'selecting' : 'bust',
      countPlayerRoll: true,
      message: canScore ? '请选择合法计分骰，然后继续投掷或保存分数。' : '爆骰！本回合得分丢失。',
    })
    if (!canScore) await handleHumanBust(rolled, definitionIds, activeRun, afterRoll)
  }, [animateRoll, handleHumanBust, makeRoll, play, send])

  const startGame = useCallback(() => {
    runId.current += 1
    rollAbort.current?.abort()
    unlockAudio()
    const next = send({ type: 'START_GAME', config: normalizeSettings(settings) })
    stateRef.current = next
    setGameStarted(true)
    setSettingsOpen(false)
    setRulesOpen(false)
  }, [send, settings, unlockAudio])

  const roll = useCallback(() => {
    const current = stateRef.current
    if (current.currentPlayer !== 'human' || current.phase === 'rolling') return
    unlockAudio()
    if (current.phase === 'ready') {
      void performHumanRoll(fullPlayerLoadout(current.config))
      return
    }
    if (current.phase !== 'selecting') return
    if (!selection.valid) {
      send({
        type: 'SET_MESSAGE',
        message: selectedDice.length
          ? '当前选择中含有不能计分的骰子，请取消它们。'
          : '继续投掷前，至少选择一颗合法计分骰。',
      })
      return
    }

    const remaining = current.rolledDice.filter((die) => !die.selected)
    const kept = current.rolledDice.filter((die) => die.selected)
    const hotDice = remaining.length === 0
    const addition = selectedScore
    const nextDefinitions = hotDice
      ? fullPlayerLoadout(current.config)
      : remaining.map((die) => die.definitionId)
    const scheduledRun = ++runId.current

    send({
      type: 'LOCK_SELECTION',
      keptDice: kept,
      score: addition,
      nextDiceCount: nextDefinitions.length,
      hotDice,
      message: hotDice ? 'HOT DICE！全部骰子都已计分，获得一整把新骰子。' : `已锁定 ${addition} 分，继续挑战运气……`,
    })
    play(hotDice ? 'hot-dice' : 'lock')
    window.setTimeout(() => {
      if (scheduledRun === runId.current) void performHumanRoll(nextDefinitions)
    }, delayFor(hotDice ? 'hotDice' : 'betweenRolls'))
  }, [delayFor, performHumanRoll, play, selectedDice.length, selectedScore, selection.valid, send, unlockAudio])

  const bank = useCallback(() => {
    const current = stateRef.current
    if (current.currentPlayer !== 'human' || current.phase !== 'selecting') return
    unlockAudio()
    if (!selection.valid) {
      send({
        type: 'SET_MESSAGE',
        message: selectedDice.length
          ? '保存前请取消所有不能计分的骰子。'
          : '请先从本次投掷中选择合法计分骰。',
      })
      return
    }

    const turnTotal = current.turnScore + selectedScore
    const scheduledRun = ++runId.current
    const next = send({
      type: 'BANK',
      player: 'human',
      turnTotal,
      keptDice: selectedDice,
      message: `你保存了 ${turnTotal} 分，骰盅交给对手。`,
      winningMessage: `你保存 ${turnTotal} 分并赢下了这局！`,
    })
    const won = next.winner === 'human'
    play(won ? 'victory' : 'bank')
    recordHumanTurn(turnTotal, current.rollStreak, won)
    if (!won) {
      window.setTimeout(() => {
        if (scheduledRun === runId.current) startAi(next)
      }, delayFor('handoff'))
    }
  }, [delayFor, play, recordHumanTurn, selectedDice, selectedScore, selection.valid, send, startAi, unlockAudio])

  const toggleDie = useCallback((id: string) => {
    const current = stateRef.current
    if (current.phase !== 'selecting' || current.currentPlayer !== 'human') return
    unlockAudio()
    if (current.doubledSelection) {
      send({ type: 'SET_MESSAGE', message: '孤注一掷已经确认，请保持当前选择并继续投掷或保存。' })
      return
    }
    send({ type: 'TOGGLE_DIE', dieId: id })
    play('select')
  }, [play, send, unlockAudio])

  const useModifier = useCallback((modifierId: string) => {
    const current = stateRef.current
    const modifier = getModifier(modifierId)
    if (
      current.currentPlayer !== 'human'
      || current.phase !== 'selecting'
      || !modifier?.activation
      || !current.config.modifierIds.includes(modifier.id)
      || !canUseModifier(modifier, current.modifierUsage)
    ) return

    unlockAudio()
    if (modifier.activation.ability === 'golden-one') {
      const selected = current.rolledDice.filter((die) => die.selected)
      if (selected.length !== 1) {
        send({ type: 'SET_MESSAGE', message: '使用黄金一点前，请只选择一颗本次新投出的骰子。' })
        return
      }
      send({
        type: 'USE_GOLDEN_ONE',
        modifierId,
        scope: modifier.activation.scope,
        dieId: selected[0].id,
        message: '黄金一点将选中的骰子变成了 1。',
      })
      play('select')
      return
    }

    if (!selection.valid) {
      send({ type: 'SET_MESSAGE', message: '使用孤注一掷前，请先完成一个合法计分选择。' })
      return
    }
    send({
      type: 'USE_DOUBLE_DOWN',
      modifierId,
      scope: modifier.activation.scope,
      message: `孤注一掷！当前选择价值 ${modifiedSelectionScore * 2} 分。`,
    })
    play('lock')
  }, [modifiedSelectionScore, play, selection.valid, send, unlockAudio])

  const updateSettings = useCallback((updates: Partial<GameSettings>) => {
    setSettings((current) => normalizeSettings({ ...current, ...updates }))
  }, [])

  const updateLoadoutDie = useCallback((index: number, definitionId: string) => {
    setSettings((current) => normalizeSettings({
      ...current,
      dieLoadout: current.dieLoadout.map((id, dieIndex) => dieIndex === index ? definitionId : id),
    }))
  }, [])

  const toggleModifier = useCallback((modifierId: string) => {
    if (!getModifier(modifierId)) return
    setSettings((current) => normalizeSettings({
      ...current,
      modifierIds: current.modifierIds.includes(modifierId)
        ? current.modifierIds.filter((id) => id !== modifierId)
        : [...current.modifierIds, modifierId],
    }))
  }, [])

  const toggleAudio = useCallback(() => {
    const next = { ...audioPreferences, enabled: !audioPreferences.enabled }
    audio.setEnabled(next.enabled)
    if (next.enabled) {
      void audio.unlock().then((ready) => {
        if (ready) audio.play('select')
      })
    }
    setAudioPreferences(next)
  }, [audio, audioPreferences])

  const setAudioVolume = useCallback((volume: number) => {
    const normalized = normalizeAudioPreferences({ enabled: audioPreferences.enabled, volume })
    audio.setVolume(normalized.volume)
    if (normalized.enabled) unlockAudio()
    setAudioPreferences(normalized)
  }, [audio, audioPreferences.enabled, unlockAudio])

  return {
    state,
    presentationEvent,
    settings,
    stats,
    audioPreferences,
    gameStarted,
    settingsOpen,
    rulesOpen,
    storageWarning,
    selection,
    selectedScore,
    actions: {
      startGame,
      roll,
      bank,
      toggleDie,
      useModifier,
      setSettingsOpen,
      setRulesOpen,
      updateSettings,
      updateLoadoutDie,
      toggleModifier,
      toggleAudio,
      setAudioVolume,
      dismissStorageWarning: () => setStorageWarning(false),
    },
  }
}
