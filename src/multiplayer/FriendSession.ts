import { applyMatchCommand, createDuel, type DuelState, type MatchCommand, type SeatId } from '../game/duel'
import { rollDice } from '../game/dice'
import { decodeInvitation, encodeInvitation, parseCommand, isDuelSnapshot, PROTOCOL_VERSION, RULES_VERSION } from './protocol'

export type ConnectionStatus = 'idle' | 'connecting' | 'waiting' | 'connected' | 'disconnected' | 'failed' | 'ended'
export interface FriendSnapshot { role: SeatId | null; state: DuelState; status: ConnectionStatus; error: string; pending: boolean; preview: { actor: SeatId; ids: string[] } | null }
const ICE_SERVERS = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }]
/** The host authority lives outside React and outside every presentation/visibility clock. */
export class FriendSession {
  private snapshot: FriendSnapshot = { role: null, state: createDuel(), status: 'idle', error: '', pending: false, preview: null }
  private listeners = new Set<() => void>()
  private pc?: RTCPeerConnection
  private channel?: RTCDataChannel
  private generation = 0
  private timer?: ReturnType<typeof setTimeout>
  private pendingTimer?: ReturnType<typeof setTimeout>
  private session = ''
  private secret = ''
  private channelId = ''
  private seen = new Set<string>()
  private alive = true
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.snapshot
  private publish(patch: Partial<FriendSnapshot>) { if (!this.alive) return; this.snapshot = { ...this.snapshot, ...patch }; for (const fn of this.listeners) fn() }
  private send(packet: object) { if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify({ session: this.session, channel: this.channelId, ...packet })) }
  private broadcast() { this.send({ type: 'STATE', rules: RULES_VERSION, state: this.snapshot.state }) }
  private fail(message: string) { clearTimeout(this.timer); this.publish({ status: 'failed', error: message, pending: false }); this.closeTransport() }
  private closeTransport() { ++this.generation; clearTimeout(this.timer); clearTimeout(this.pendingTimer); this.channel?.close(); this.pc?.close(); this.channel = undefined; this.pc = undefined }
  private armTimeout() { clearTimeout(this.timer); this.timer = setTimeout(() => this.fail('30 秒内未能建立连接。请重新交换连接文本，或尝试另一网络；部分网络需要中继，当前版本只支持直连。'), 30000) }
  private peer(host: boolean): RTCPeerConnection {
    this.closeTransport()
    if (typeof RTCPeerConnection === 'undefined') throw new Error('当前环境不支持 WebRTC，请使用新版浏览器或 Mac 应用。')
    const generation = this.generation
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pc = pc
    const bind = (channel: RTCDataChannel) => {
      if (generation !== this.generation) { channel.close(); return }
      if (this.channel) { channel.close(); return }
      this.channel = channel
      channel.onopen = () => {
        if (generation !== this.generation) return
        clearTimeout(this.timer)
        if (host) { this.publish({ status: 'connected', error: '', pending: false }); this.broadcast() }
      }
      channel.onmessage = (event) => { if (generation === this.generation) this.receive(event.data) }
      channel.onclose = () => { if (generation === this.generation && this.snapshot.status !== 'ended') this.publish({ status: 'disconnected', pending: false, error: '连接中断，局面保留在当前窗口。请重新交换邀请与回应。' }) }
      channel.onerror = () => { if (generation === this.generation) this.publish({ status: 'disconnected', pending: false, error: '连接出现问题，请重新连接。' }) }
    }
    if (host) bind(pc.createDataChannel('tavern-bones', { ordered: true }))
    else pc.ondatachannel = (event) => bind(event.channel)
    pc.onconnectionstatechange = () => {
      if (generation !== this.generation) return
      if (pc.connectionState === 'failed') this.fail('直连失败。请重新交换连接文本，或尝试另一网络。')
      else if (pc.connectionState === 'disconnected') this.publish({ status: 'disconnected', pending: false, error: '网络暂时断开，等待恢复或重新连接。' })
      else if (pc.connectionState === 'connected' && this.channel?.readyState === 'open') {
        this.publish({ status: 'connected', error: '', pending: false }); if (host) this.broadcast()
      }
    }
    return pc
  }
  private async gather(pc: RTCPeerConnection): Promise<string> {
    if (pc.iceGatheringState !== 'complete') await new Promise<void>((resolve, reject) => {
      const finish = () => { clearTimeout(timeout); pc.removeEventListener('icegatheringstatechange', change); pc.removeEventListener('connectionstatechange', closed) }
      const change = () => { if (pc.iceGatheringState === 'complete') { finish(); resolve() } }
      const closed = () => { if (pc.connectionState === 'closed') { finish(); reject(new Error('连接已取消。')) } }
      const timeout = setTimeout(() => { finish(); reject(new Error('收集连接信息超时，请重试或更换网络。')) }, 15000)
      pc.addEventListener('icegatheringstatechange', change); pc.addEventListener('connectionstatechange', closed); change()
    })
    if (pc !== this.pc || !this.alive || !pc.localDescription) throw new Error('连接已取消。')
    return pc.localDescription.sdp
  }
  async createInvite(): Promise<string> {
    const resume = this.snapshot.state.stage !== 'lobby' || this.snapshot.state.revision > 0
    if (this.snapshot.role && this.snapshot.role !== 'host') throw new Error('请由原房主创建重连邀请。')
    this.session ||= crypto.randomUUID(); this.secret ||= crypto.randomUUID(); this.channelId = crypto.randomUUID()
    this.publish({ role: 'host', status: 'connecting', error: '', pending: false })
    try {
      const pc = this.peer(true)
      await pc.setLocalDescription(await pc.createOffer())
      const sdp = await this.gather(pc)
      this.publish({ status: 'waiting' })
      return encodeInvitation({ protocol: PROTOCOL_VERSION, rules: RULES_VERSION, kind: 'offer', session: this.session, secret: this.secret, channel: this.channelId, resume, sdp })
    } catch (error) { this.fail((error as Error).message); throw error }
  }
  async acceptInvite(text: string): Promise<string> {
    const packet = decodeInvitation(text, 'offer')
    if (this.snapshot.role === 'host') throw new Error('房主应粘贴朋友的回应。')
    if (this.session && (packet.session !== this.session || packet.secret !== this.secret)) throw new Error('这是另一场对局的邀请，请先返回酒馆。')
    if (!this.session && packet.resume) throw new Error('原会话已关闭，无法恢复；请双方创建新对局。')
    this.session = packet.session; this.secret = packet.secret; this.channelId = packet.channel
    this.publish({ role: 'guest', status: 'connecting', error: '', pending: false })
    try {
      const pc = this.peer(false)
      await pc.setRemoteDescription({ type: 'offer', sdp: packet.sdp }); await pc.setLocalDescription(await pc.createAnswer())
      const sdp = await this.gather(pc)
      this.publish({ status: 'waiting' }); this.armTimeout()
      return encodeInvitation({ ...packet, kind: 'answer', sdp })
    } catch (error) { this.fail((error as Error).message); throw error }
  }
  async acceptAnswer(text: string) {
    const packet = decodeInvitation(text, 'answer')
    if (this.snapshot.role !== 'host' || !this.pc || packet.session !== this.session || packet.secret !== this.secret || packet.channel !== this.channelId) throw new Error('回应不属于当前邀请，请重新复制最新回应。')
    this.publish({ status: 'connecting', error: '' }); this.armTimeout()
    try { await this.pc.setRemoteDescription({ type: 'answer', sdp: packet.sdp }) } catch (error) { this.fail('无法使用此回应，请重新建立连接。'); throw error }
  }
  command(command: MatchCommand) {
    if (this.snapshot.status !== 'connected' || this.snapshot.pending || !this.snapshot.role) return
    const id = crypto.randomUUID()
    if (this.snapshot.role === 'host') this.execute('host', command, this.snapshot.state.revision, id)
    else { this.publish({ pending: true, error: '' }); this.send({ type: 'COMMAND', id, revision: this.snapshot.state.revision, command }); clearTimeout(this.pendingTimer); this.pendingTimer = setTimeout(() => this.publish({ status: 'disconnected', pending: false, error: '房主暂未响应。局面保留，请重新连接。' }), 30000) }
  }
  preview(ids: string[]) { if (this.snapshot.status === 'connected') this.send({ type: 'PREVIEW', revision: this.snapshot.state.revision, ids }) }
  private execute(actor: SeatId, value: unknown, revision: number, id: string) {
    if (this.seen.has(id)) { this.broadcast(); return }
    try {
      if (this.snapshot.status !== 'connected') throw new Error('连接恢复前不能操作。')
      if (revision !== this.snapshot.state.revision) throw new Error('局面已更新，请重新操作。')
      const command = parseCommand(value)
      const state = applyMatchCommand(this.snapshot.state, actor, command, (ids) => rollDice(ids, ids.length, () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296))
      this.seen.add(id); if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!)
      this.publish({ state, error: '', preview: null }); this.broadcast()
    } catch (error) {
      const message = (error as Error).message
      if (actor === 'host') this.publish({ error: message })
      else this.send({ type: 'REJECT', error: message, state: this.snapshot.state })
    }
  }
  private receive(raw: unknown) {
    if (typeof raw !== 'string' || raw.length > 65536) { this.fail('收到无效的联机消息。'); return }
    try {
      const p = JSON.parse(raw)
      if (!p || p.session !== this.session || p.channel !== this.channelId) return
      if (p.type === 'LEAVE') { this.publish({ status: 'ended', pending: false, error: '朋友已离开，此会话结束。' }); this.closeTransport(); return }
      if (p.type === 'COMMAND' && this.snapshot.role === 'host') {
        if (typeof p.id !== 'string' || p.id.length > 100 || !Number.isSafeInteger(p.revision)) throw new Error('无效操作编号。')
        this.execute('guest', p.command, p.revision, p.id)
      } else if ((p.type === 'STATE' || p.type === 'REJECT') && this.snapshot.role === 'guest') {
        if (p.type === 'STATE' && p.rules !== RULES_VERSION) throw new Error('双方规则版本不一致。')
        // Host is trusted, but malformed/older snapshots must never reach rendering.
        if (!isDuelSnapshot(p.state) || p.state.revision < this.snapshot.state.revision) throw new Error('无效局面快照。')
        clearTimeout(this.timer); clearTimeout(this.pendingTimer); this.publish({ state: p.state, status: 'connected', pending: false, error: p.type === 'REJECT' ? String(p.error).slice(0,200) : '', preview: null })
      } else if (p.type === 'PREVIEW') {
        const actor = this.snapshot.role === 'host' ? 'guest' : 'host'
        if (p.revision === this.snapshot.state.revision && actor === this.snapshot.state.active && Array.isArray(p.ids) && p.ids.length <= 7 && p.ids.every((id: unknown) => typeof id === 'string' && this.snapshot.state.game.rolledDice.some((d) => d.id === id))) this.publish({ preview: { actor, ids: p.ids } })
      }
    } catch (error) { this.fail((error as Error).message || '无法读取联机消息。') }
  }
  activate = () => { this.alive = true }
  dispose = () => { this.send({ type: 'LEAVE' }); this.closeTransport(); this.alive = false; this.listeners.clear() }
}
