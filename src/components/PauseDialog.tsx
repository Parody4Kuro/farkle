import { AccessibleDialog } from './AccessibleDialog'

export function PauseDialog({ canResume, onResume, onHome }: { canResume: boolean; onResume: () => void; onHome: () => void }) {
  return <AccessibleDialog ariaLabelledBy="pause-title" className="pause-dialog" dismissible={false}>
    <section className="pause-panel">
      <span className="eyebrow">TAKE YOUR TIME</span><h2 id="pause-title">对局已暂停</h2>
      <p>骰子、对手和本回合分数都停在这里。准备好后，再继续。</p>
      {!canResume && <p role="status">请先回到游戏窗口并关闭其他面板。</p>}
      <button className="night-primary" data-autofocus disabled={!canResume} onClick={onResume}>继续</button>
      <button className="night-text" onClick={onHome}>返回酒馆</button>
    </section>
  </AccessibleDialog>
}
