// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GAME_SETTINGS } from '../game/rules'
import { Dice } from './Dice'
import { RulesModal } from './RulesModal'
import { SettingsModal } from './SettingsModal'

afterEach(cleanup)

describe('dice accessibility', () => {
  it('uses a button only for interactive dice', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(<Dice value={5} onClick={onClick} />)
    const button = screen.getByRole('button', { name: '骰子点数 5' })
    await user.click(button)
    expect(onClick).toHaveBeenCalledOnce()

    rerender(<Dice value={5} locked disabled />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('img', { name: '骰子点数 5' })).not.toBeNull()
  })
})

describe('settings and rules dialogs', () => {
  it('exposes Chinese settings controls and immediate audio callbacks', async () => {
    const user = userEvent.setup()
    const onToggleAudio = vi.fn()
    const onAudioVolumeChange = vi.fn()
    const onStart = vi.fn()
    render(
      <SettingsModal
        settings={{ ...DEFAULT_GAME_SETTINGS, dieLoadout: [...DEFAULT_GAME_SETTINGS.dieLoadout] }}
        audioPreferences={{ enabled: true, volume: 0.6 }}
        isFirstGame
        onUpdate={vi.fn()}
        onLoadoutChange={vi.fn()}
        onToggleModifier={vi.fn()}
        onToggleAudio={onToggleAudio}
        onAudioVolumeChange={onAudioVolumeChange}
        onStart={onStart}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog').hasAttribute('open')).toBe(true)
    await user.click(screen.getByRole('button', { name: '音效已开启' }))
    fireEvent.change(screen.getByRole('slider'), { target: { value: '35' } })
    await user.click(screen.getByRole('button', { name: '开始游戏' }))

    expect(onToggleAudio).toHaveBeenCalledOnce()
    expect(onAudioVolumeChange).toHaveBeenCalledWith(0.35)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('renders rules from the same scoring and modifier definitions', () => {
    render(<RulesModal onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '如何赢下这局' })).not.toBeNull()
    expect(screen.getByText('1500 分')).not.toBeNull()
    expect(screen.getByText('幸运护符')).not.toBeNull()
    expect(screen.getByText(/同点数组合最多使用六颗骰子/)).not.toBeNull()
  })
})
