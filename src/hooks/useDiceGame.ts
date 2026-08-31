import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chooseAiDice, shouldAiContinue } from '../game/ai'
import { DEFAULT_LOADOUT, rollDice } from '../game/dice'
import { getTurnDiceCount, hasActiveAbility, shouldPreventBust } from '../game/modifiers'
import { bankScore, createInitialState, hasWon } from '../game/rules'
import { hasAnyScore, validateSelectedDice } from '../game/scoring'
import type { GameSettings, GameState, GameStats } from '../game/types'

const SETTINGS_KEY = 'tavern-bones-settings-v1'
const STATS_KEY = 'tavern-bones-stats-v1'

const DEFAULT_SETTINGS: GameSettings = {
  targetScore: 4000,
  aiDifficulty: 'normal',
  dieLoadout: DEFAULT_LOADOUT,
  modifierIds: [],
}

const DEFAULT_STATS: GameStats = {
  wins: 0,
  losses: 0,
  highestTurnScore: 0,
  longestRollStreak: 0,
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback
  } catch {
    return fallback
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function fullPlayerLoadout(settings: GameSettings): string[] {
  const diceCount = getTurnDiceCount(settings.modifierIds)
  return Array.from({ length: diceCount }, (_, index) => settings.dieLoadout[index] ?? 'standard')
}

export function useDiceGame() {
  const [settings, setSettings] = useState<GameSettings>(() => loadStored(SETTINGS_KEY, DEFAULT_SETTINGS))
  const [stats, setStats] = useState<GameStats>(() => loadStored(STATS_KEY, DEFAULT_STATS))
  const [state, setState] = useState<GameState>(() => createInitialState(settings.targetScore))
  const [gameStarted, setGameStarted] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [isRolling, setIsRolling] = useState(false)
  const runId = useRef(0)

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  }, [stats])

  useEffect(() => () => {
    runId.current += 1
  }, [])

  const selectedDice = useMemo(
    () => state.rolledDice.filter((die) => die.selected),
    [state.rolledDice],
  )
  const selection = useMemo(
    () => validateSelectedDice(selectedDice.map((die) => die.value)),
    [selectedDice],
  )
  const selectedScore = selection.valid
    ? selection.score * (state.doubledSelection ? 2 : 1)
    : selection.score

  const recordTurn = useCallback((turnScore: number, rollStreak: number, won: boolean) => {
    setStats((current) => ({
      ...current,
      wins: current.wins + (won ? 1 : 0),
      highestTurnScore: Math.max(current.highestTurnScore, turnScore),
      longestRollStreak: Math.max(current.longestRollStreak, rollStreak),
    }))
  }, [])

  const beginHumanTurn = useCallback((scores: GameState['scores'], turnNumber: number, doubleDownUsed: boolean) => {
    const diceCount = getTurnDiceCount(settings.modifierIds)
    setState({
      ...createInitialState(settings.targetScore),
      scores,
      turnNumber,
      diceToRoll: diceCount,
      modifierUsage: {
        luckyCharmUsed: false,
        goldenOneUsed: false,
        doubleDownUsed,
      },
    })
  }, [settings.modifierIds, settings.targetScore])

  const runAiTurn = useCallback(async (startingScores: GameState['scores'], turnNumber: number, doubleDownUsed: boolean, activeRun: number) => {
    let scores = startingScores
    let turnScore = 0
    let rollStreak = 0
    let definitionIds = Array<string>(6).fill('standard')
    let lockedDice: GameState['lockedDice'] = []

    setState((current) => ({
      ...current,
      currentPlayer: 'ai',
      phase: 'ai_turn',
      turnScore: 0,
      rolledDice: [],
      lockedDice: [],
      diceToRoll: 6,
      isHotDice: false,
      message: 'The Innkeeper gathers the bones…',
    }))

    while (activeRun === runId.current) {
      setIsRolling(true)
      setState((current) => ({ ...current, message: `The Innkeeper rolls ${definitionIds.length} dice…`, rolledDice: [] }))
      await delay(650)
      if (activeRun !== runId.current) return

      const rolled = rollDice(definitionIds, definitionIds.length)
      rollStreak += 1
      setIsRolling(false)
      setState((current) => ({
        ...current,
        rolledDice: rolled,
        diceToRoll: rolled.length,
        rollStreak,
        message: 'The Innkeeper studies the cast…',
      }))
      await delay(750)
      if (activeRun !== runId.current) return

      if (!hasAnyScore(rolled.map((die) => die.value))) {
        setState((current) => ({
          ...current,
          phase: 'bust',
          turnScore: 0,
          message: 'BUST! The Innkeeper loses the turn score.',
        }))
        await delay(1250)
        if (activeRun !== runId.current) return
        beginHumanTurn(scores, turnNumber + 1, doubleDownUsed)
        return
      }

      const choice = chooseAiDice(rolled.map((die) => die.value))
      const chosen = rolled.filter((_, index) => choice.indices.includes(index)).map((die) => ({ ...die, selected: true }))
      const remaining = rolled.filter((_, index) => !choice.indices.includes(index))
      const hotDice = remaining.length === 0

      setState((current) => ({
        ...current,
        rolledDice: rolled.map((die, index) => ({ ...die, selected: choice.indices.includes(index) })),
        message: `The Innkeeper keeps ${chosen.length} ${chosen.length === 1 ? 'die' : 'dice'} for ${choice.score} points.`,
      }))
      await delay(850)
      if (activeRun !== runId.current) return

      turnScore += choice.score
      lockedDice = [...lockedDice, ...chosen.map((die) => ({ ...die, selected: false }))]
      const nextCount = hotDice ? 6 : remaining.length
      setState((current) => ({
        ...current,
        turnScore,
        lockedDice,
        rolledDice: [],
        diceToRoll: nextCount,
        isHotDice: hotDice,
        message: hotDice ? 'HOT DICE! The Innkeeper earns a fresh handful.' : 'The Innkeeper weighs the risk…',
      }))
      await delay(hotDice ? 950 : 600)
      if (activeRun !== runId.current) return

      const continueRolling = shouldAiContinue({
        difficulty: settings.aiDifficulty,
        turnScore,
        remainingDice: nextCount,
        aiScore: scores.ai,
        humanScore: scores.human,
        targetScore: settings.targetScore,
        hotDice,
      })

      if (!continueRolling) {
        scores = bankScore(scores, 'ai', turnScore)
        const won = hasWon(scores.ai, settings.targetScore)
        setState((current) => ({
          ...current,
          scores,
          turnScore: won ? turnScore : 0,
          rolledDice: [],
          lockedDice: won ? lockedDice : [],
          winner: won ? 'ai' : undefined,
          phase: won ? 'game_over' : 'ai_turn',
          message: won
            ? `The Innkeeper banks ${turnScore} and wins the match.`
            : `The Innkeeper banks ${turnScore} points.`,
        }))
        if (won) {
          setStats((current) => ({
            ...current,
            losses: current.losses + 1,
            longestRollStreak: Math.max(current.longestRollStreak, rollStreak),
          }))
          return
        }
        await delay(900)
        if (activeRun !== runId.current) return
        beginHumanTurn(scores, turnNumber + 1, doubleDownUsed)
        return
      }

      definitionIds = hotDice
        ? Array<string>(6).fill('standard')
        : remaining.map((die) => die.definitionId)
      setState((current) => ({ ...current, message: 'The Innkeeper tempts fortune again…', isHotDice: false }))
      await delay(450)
    }
  }, [beginHumanTurn, settings.aiDifficulty, settings.targetScore])

  const startAi = useCallback((scores: GameState['scores'], turnNumber: number, doubleDownUsed: boolean) => {
    const activeRun = ++runId.current
    void runAiTurn(scores, turnNumber, doubleDownUsed, activeRun)
  }, [runAiTurn])

  const handleHumanBust = useCallback(async (
    rolled: GameState['rolledDice'],
    definitionIds: string[],
    activeRun: number,
  ) => {
    const canReroll = shouldPreventBust(settings.modifierIds, state.modifierUsage)
    if (canReroll) {
      setState((current) => ({
        ...current,
        phase: 'bust',
        rolledDice: rolled,
        message: 'Lucky Charm! The bust is forgiven — the dice return to your hand.',
        modifierUsage: { ...current.modifierUsage, luckyCharmUsed: true },
      }))
      await delay(1150)
      if (activeRun !== runId.current) return
      setIsRolling(true)
      setState((current) => ({ ...current, phase: 'rolling', rolledDice: [], message: 'The charm casts the bones again…' }))
      await delay(650)
      if (activeRun !== runId.current) return
      const rerolled = rollDice(definitionIds, definitionIds.length)
      setIsRolling(false)
      if (!hasAnyScore(rerolled.map((die) => die.value))) {
        setState((current) => ({
          ...current,
          phase: 'bust',
          rolledDice: rerolled,
          turnScore: 0,
          lockedDice: [],
          message: '爆骰！BUST — 徽章已耗尽，本回合得分丢失。',
        }))
        await delay(1400)
        if (activeRun === runId.current) startAi(state.scores, state.turnNumber, state.modifierUsage.doubleDownUsed)
        return
      }
      setState((current) => ({
        ...current,
        phase: 'selecting',
        rolledDice: rerolled,
        message: 'The charm held. Choose scoring dice.',
      }))
      return
    }

    setState((current) => ({
      ...current,
      phase: 'bust',
      rolledDice: rolled,
      turnScore: 0,
      lockedDice: [],
      message: '爆骰！BUST — 本回合得分丢失。',
    }))
    setStats((current) => ({
      ...current,
      longestRollStreak: Math.max(current.longestRollStreak, state.rollStreak + 1),
    }))
    await delay(1400)
    if (activeRun === runId.current) startAi(state.scores, state.turnNumber, state.modifierUsage.doubleDownUsed)
  }, [settings.modifierIds, startAi, state.modifierUsage, state.rollStreak, state.scores, state.turnNumber])

  const performHumanRoll = useCallback(async (definitionIds: string[]) => {
    const activeRun = ++runId.current
    setIsRolling(true)
    setState((current) => ({
      ...current,
      phase: 'rolling',
      rolledDice: [],
      isHotDice: false,
      message: `Casting ${definitionIds.length} ${definitionIds.length === 1 ? 'die' : 'dice'}…`,
    }))
    await delay(650)
    if (activeRun !== runId.current) return
    const rolled = rollDice(definitionIds, definitionIds.length)
    setIsRolling(false)
    if (!hasAnyScore(rolled.map((die) => die.value))) {
      await handleHumanBust(rolled, definitionIds, activeRun)
      return
    }
    setState((current) => ({
      ...current,
      phase: 'selecting',
      rolledDice: rolled,
      diceToRoll: rolled.length,
      rollStreak: current.rollStreak + 1,
      message: 'Choose any legal scoring dice, then roll again or bank.',
    }))
  }, [handleHumanBust])

  const startGame = useCallback(() => {
    runId.current += 1
    const initial = createInitialState(settings.targetScore)
    initial.diceToRoll = getTurnDiceCount(settings.modifierIds)
    setState(initial)
    setGameStarted(true)
    setSettingsOpen(false)
    setIsRolling(false)
  }, [settings.modifierIds, settings.targetScore])

  const roll = useCallback(() => {
    if (state.currentPlayer !== 'human' || isRolling) return
    if (state.phase === 'ready') {
      void performHumanRoll(fullPlayerLoadout(settings))
      return
    }
    if (state.phase !== 'selecting') return
    if (!selection.valid) {
      setState((current) => ({
        ...current,
        message: selectedDice.length
          ? 'That selection includes a die that cannot score. Leave no dead dice selected.'
          : 'Choose at least one scoring die before rolling again.',
      }))
      return
    }

    const remaining = state.rolledDice.filter((die) => !die.selected)
    const kept = state.rolledDice.filter((die) => die.selected).map((die) => ({ ...die, selected: false }))
    const hotDice = remaining.length === 0
    const addition = selection.score * (state.doubledSelection ? 2 : 1)
    const nextTurnScore = state.turnScore + addition
    const nextDefinitions = hotDice
      ? fullPlayerLoadout(settings)
      : remaining.map((die) => die.definitionId)
    const scheduledRun = ++runId.current

    setState((current) => ({
      ...current,
      phase: 'rolling',
      turnScore: nextTurnScore,
      lockedDice: [...current.lockedDice, ...kept],
      rolledDice: [],
      diceToRoll: nextDefinitions.length,
      isHotDice: hotDice,
      doubledSelection: false,
      message: hotDice ? 'HOT DICE! Every bone scored — take a fresh handful.' : `${addition} points kept. Fortune calls again…`,
    }))
    window.setTimeout(() => {
      if (scheduledRun === runId.current) void performHumanRoll(nextDefinitions)
    }, hotDice ? 950 : 450)
  }, [isRolling, performHumanRoll, selectedDice.length, selection.score, selection.valid, settings, state])

  const bank = useCallback(() => {
    if (state.currentPlayer !== 'human' || state.phase !== 'selecting' || isRolling) return
    if (!selection.valid) {
      setState((current) => ({
        ...current,
        message: selectedDice.length > 0
          ? 'Remove non-scoring dice before banking.'
          : 'Choose at least one scoring die from this cast before banking.',
      }))
      return
    }
    const addition = selection.score * (state.doubledSelection ? 2 : 1)
    const turnTotal = state.turnScore + addition
    if (turnTotal <= 0) {
      setState((current) => ({ ...current, message: 'You need a scoring selection before you can bank.' }))
      return
    }
    const scores = bankScore(state.scores, 'human', turnTotal)
    const won = hasWon(scores.human, state.targetScore)
    const scheduledRun = ++runId.current
    setState((current) => ({
      ...current,
      scores,
      turnScore: won ? turnTotal : 0,
      rolledDice: [],
      lockedDice: won ? current.lockedDice : [],
      phase: won ? 'game_over' : 'ai_turn',
      winner: won ? 'human' : undefined,
      message: won ? `You bank ${turnTotal} and win the match!` : `You bank ${turnTotal} points. The cup passes across the table.`,
    }))
    recordTurn(turnTotal, state.rollStreak, won)
    if (!won) {
      window.setTimeout(() => {
        if (scheduledRun === runId.current) {
          startAi(scores, state.turnNumber, state.modifierUsage.doubleDownUsed)
        }
      }, 800)
    }
  }, [isRolling, recordTurn, selectedDice.length, selection.score, selection.valid, startAi, state])

  const toggleDie = useCallback((id: string) => {
    if (state.phase !== 'selecting' || state.currentPlayer !== 'human') return
    if (state.doubledSelection) {
      setState((current) => ({ ...current, message: 'Double Down is committed. Keep this selection by rolling again or banking.' }))
      return
    }
    setState((current) => ({
      ...current,
      rolledDice: current.rolledDice.map((die) => die.id === id ? { ...die, selected: !die.selected } : die),
    }))
  }, [state.currentPlayer, state.doubledSelection, state.phase])

  const useGoldenOne = useCallback(() => {
    if (!hasActiveAbility(settings.modifierIds, 'golden-one') || state.modifierUsage.goldenOneUsed) return
    if (selectedDice.length !== 1) {
      setState((current) => ({ ...current, message: 'Select exactly one newly rolled die for Golden One.' }))
      return
    }
    const targetId = selectedDice[0].id
    setState((current) => ({
      ...current,
      rolledDice: current.rolledDice.map((die) => die.id === targetId ? { ...die, value: 1 } : die),
      modifierUsage: { ...current.modifierUsage, goldenOneUsed: true },
      message: 'Golden One turns the chosen die to a one.',
    }))
  }, [selectedDice, settings.modifierIds, state.modifierUsage.goldenOneUsed])

  const useDoubleDown = useCallback(() => {
    if (!hasActiveAbility(settings.modifierIds, 'double-down') || state.modifierUsage.doubleDownUsed) return
    if (!selection.valid) {
      setState((current) => ({ ...current, message: 'Make a valid scoring selection before using Double Down.' }))
      return
    }
    setState((current) => ({
      ...current,
      doubledSelection: true,
      modifierUsage: { ...current.modifierUsage, doubleDownUsed: true },
      message: `Double Down! This selection is now worth ${selection.score * 2}.`,
    }))
  }, [selection.score, selection.valid, settings.modifierIds, state.modifierUsage.doubleDownUsed])

  const updateSettings = useCallback((updates: Partial<GameSettings>) => {
    setSettings((current) => ({ ...current, ...updates }))
  }, [])

  const updateLoadoutDie = useCallback((index: number, definitionId: string) => {
    setSettings((current) => ({
      ...current,
      dieLoadout: current.dieLoadout.map((id, dieIndex) => dieIndex === index ? definitionId : id),
    }))
  }, [])

  const toggleModifier = useCallback((modifierId: string) => {
    setSettings((current) => ({
      ...current,
      modifierIds: current.modifierIds.includes(modifierId)
        ? current.modifierIds.filter((id) => id !== modifierId)
        : [...current.modifierIds, modifierId],
    }))
  }, [])

  return {
    state,
    settings,
    stats,
    gameStarted,
    settingsOpen,
    isRolling,
    selection,
    selectedScore,
    actions: {
      startGame,
      roll,
      bank,
      toggleDie,
      useGoldenOne,
      useDoubleDown,
      setSettingsOpen,
      updateSettings,
      updateLoadoutDie,
      toggleModifier,
    },
  }
}
