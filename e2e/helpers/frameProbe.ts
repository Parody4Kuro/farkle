import type { Page } from '@playwright/test'

/** Test-only probe: includes long frames during the visible roll, not idle gaps. */
export async function beginFrameProbe(page: Page) {
  await page.evaluate(() => {
    performance.clearMeasures('tavern-roll-frame')
    let previous = performance.now(), started = false
    const sample = (now: number) => {
      const active = Boolean(document.querySelector('[data-presentation-active="roll"]'))
      if (active && started) performance.measure('tavern-roll-frame', { start: previous, end: now })
      if (started && !active) return
      started ||= active; previous = now; requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}

export async function readFrameProbe(page: Page) {
  return page.evaluate(() => {
    const values = performance.getEntriesByName('tavern-roll-frame', 'measure').map((entry) => entry.duration).sort((a,b) => a-b)
    return { samples: values.length, medianMs: values[Math.floor(values.length*.5)], p95Ms: values[Math.floor(values.length*.95)], maxMs: values.at(-1), over33Ms: values.filter((value) => value > 33.4).length, over100Ms: values.filter((value) => value > 100).length }
  })
}
