import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface Props { enabled: boolean; canRoll: boolean; canBank: boolean; onRoll: () => void; onBank: () => void; abilities: Array<{ id: string; enabled: boolean }>; onAbility: (id: string) => void }
export function GameKeyboard(props: Props) {
  const root = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  useLayoutEffect(() => { latest.current = props })
  const [holding, setHolding] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancel = () => { clearTimeout(timer); timer = undefined; setHolding(false) }
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest('input,textarea,select,[contenteditable="true"]'))
    const down = (event: KeyboardEvent) => {
      const p = latest.current, main = root.current?.closest('main')
      if (!main || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || editable(event.target) || document.querySelector('[role="dialog"],dialog[open]')) return
      const key = event.key.toLowerCase()
      if (key !== 'q') cancel()
      if (key === 't' || key === 'escape') {
        event.preventDefault()
        if (key === 'escape') {
          const detail = [...main.querySelectorAll<HTMLDetailsElement>('details[open]')].at(-1)
          if (detail) { detail.open = false; detail.querySelector<HTMLElement>('summary')?.focus(); return }
        }
        if (!event.repeat) main.querySelector<HTMLButtonElement>(key === 't' ? 'button[aria-label="查看规则"]' : 'button[aria-label="暂停对局"]')?.click()
        return
      }
      if (!p.enabled) return
      const dice = [...main.querySelectorAll<HTMLButtonElement>('button[data-die-id]:not(:disabled)')]
      const focused = dice.indexOf(document.activeElement as HTMLButtonElement)
      if (/^[1-7]$/.test(key)) { event.preventDefault(); if (!event.repeat) { const die = dice[Number(key) - 1]; die?.focus(); die?.click() } }
      else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) && dice.length) {
        event.preventDefault(); const step = key === 'arrowleft' || key === 'arrowup' ? -1 : 1
        dice[focused < 0 ? 0 : (focused + step + dice.length) % dice.length]?.focus()
      } else if (key === 'e' && focused >= 0) { event.preventDefault(); if (!event.repeat) dice[focused].click() }
      else if (key === 'f' && p.canRoll) { event.preventDefault(); if (!event.repeat) p.onRoll() }
      else if (key === 'q' && p.canBank && !event.repeat && !timer) {
        event.preventDefault(); setHolding(true)
        timer = setTimeout(() => { timer = undefined; setHolding(false); if (latest.current.enabled && latest.current.canBank && !document.querySelector('[role="dialog"],dialog[open]')) latest.current.onBank() }, 400)
      } else if (key === 'r' && !event.repeat) { const ability = p.abilities[event.shiftKey ? 1 : 0]; if (ability?.enabled) { event.preventDefault(); p.onAbility(ability.id) } }
    }
    const up = (event: KeyboardEvent) => { if (event.key.toLowerCase() === 'q') cancel() }
    document.addEventListener('keydown', down); document.addEventListener('keyup', up)
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', cancel); document.addEventListener('focusin', cancel); document.addEventListener('compositionstart', cancel)
    return () => { clearTimeout(timer); document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', cancel); document.removeEventListener('focusin', cancel); document.removeEventListener('compositionstart', cancel) }
  }, [])
  return <div ref={root} className="keyboard-hints" aria-label="键盘操作"><span>1–7 选骰 · 方向键 / E</span><span>F 继续 · 长按 Q 落袋 · T 规则</span>{holding && <span className="bank-hold" role="status">按住落袋…<i /></span>}</div>
}
