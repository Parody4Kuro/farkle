/* oxlint-disable no-empty-pattern -- Native Electron test owns its fixtures. */
import { test, expect, _electron } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { adventureReducer } from '../src/game/adventure'
import { openedNight } from '../e2e/helpers/adventureFixtures'
import { ADVENTURE_KEY, COMFORT_KEY, DEFAULT_COMFORT } from '../src/storage/adventureStorage'
import { beginFrameProbe, readFrameProbe } from '../e2e/helpers/frameProbe'

test('packaged realistic scene renders locally at 1080p with measurable frame pacing', async ({}, info) => {
  test.setTimeout(90000)
  const evidence=path.resolve('artifacts/realism'); await mkdir(evidence,{recursive:true})
  const app=await _electron.launch({ executablePath:path.resolve('release/mac-arm64/Tavern Bones.app/Contents/MacOS/Tavern Bones'), env:{ ...Object.fromEntries(Object.entries(process.env).filter(([k,v])=>v!==undefined&&k!=='ELECTRON_RUN_AS_NODE')) as Record<string,string>, TAVERN_BONES_DATA_DIR:info.outputPath('isolated-data') } })
  try {
    const page=await app.firstWindow(), errors:string[]=[], remote:string[]=[]
    page.on('pageerror',(e)=>errors.push(e.message)); page.on('request',(r)=>{if(/^https?:/.test(r.url()))remote.push(r.url())})
    await app.evaluate(({app,BrowserWindow})=>{app.focus({steal:true});const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1920,1080);w.show();w.focus();w.webContents.focus()})
    // macOS constrains windows to the attached 1470px display. Give the native
    // renderer an exact 1080p content viewport without changing system settings.
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false,screenWidth:1920,screenHeight:1080})
    const run=adventureReducer(openedNight(57,'mac-realism'),{type:'SIT'})
    await page.evaluate(({run,key,prefs,comfort})=>{localStorage.setItem(key,JSON.stringify({version:2,run,runtime:{paused:true}}));localStorage.setItem(prefs,JSON.stringify(comfort))},{run,key:ADVENTURE_KEY,prefs:COMFORT_KEY,comfort:{...DEFAULT_COMFORT,dialogue:false}})
    await page.reload(); await page.getByRole('button',{name:/^继续这一夜/}).click();await page.getByRole('button',{name:'继续',exact:true}).click()
    await expect(page.locator('.tavern-scene[data-art="realistic"] canvas')).toBeVisible();await expect(page.locator('.using-fallback')).toHaveCount(0)
    const baseline = await app.evaluate(({app}) => ({at:Date.now(),processes:app.getAppMetrics().map(({pid,cpu})=>({pid,seconds:cpu.cumulativeCPUUsage}))}))
    await beginFrameProbe(page)
    await page.getByRole('button',{name:'掷骰子',exact:true}).click();await expect(page.locator('button[data-die-id]')).toHaveCount(6)
    const fullRollFrames = await readFrameProbe(page)
    const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))
    expect(viewport.width).toBe(1920);expect(viewport.height).toBe(1080)
    await page.screenshot({path:path.join(evidence,'mac-1080.png')})
    const frames=await page.locator('canvas').evaluate((c)=>({...c.dataset}))
    const system=await app.evaluate(({app})=>({at:Date.now(),platform:process.platform,arch:process.arch,electron:process.versions.electron,gpu:app.getGPUFeatureStatus(),processes:app.getAppMetrics().map(({pid,type,cpu,memory})=>({pid,type,cpu,memory}))}))
    const intervalSeconds=(system.at-baseline.at)/1000
    const cpuSeconds=system.processes.reduce((sum,p)=>sum+Math.max(0,p.cpu.cumulativeCPUUsage-(baseline.processes.find((b)=>b.pid===p.pid)?.seconds??0)),0)
    const resources={intervalSeconds,cpuSeconds,averageCpuPercent:cpuSeconds/intervalSeconds*100,summedWorkingSetKiB:system.processes.reduce((sum,p)=>sum+p.memory.workingSetSize,0)}
    expect(errors).toEqual([]);expect(remote).toEqual([])
    expect(fullRollFrames.medianMs).toBeLessThan(25)
    await writeFile(path.join(evidence,'mac-metrics.json'),JSON.stringify({machine:os.cpus()[0]?.model,ramBytes:os.totalmem(),contentViewport:'CDP 1920x1080; native GPU renderer; macOS window limited by attached display',viewport,fullRollFrames,frames,resources,system,errors,remote,at:new Date().toISOString()},null,2)+'\n')
    await page.getByRole('button',{name:'看向对手',exact:true}).click();await page.waitForTimeout(500);await page.screenshot({path:path.join(evidence,'mac-mara.png')})
  } finally { await app.close() }
})
