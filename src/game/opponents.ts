import type { AiDifficulty } from './types'

export interface OpponentDefinition {
  id: string
  name: string
  title: string
  seat: string
  difficulty: AiDifficulty
  loadout: string[]
  color: string
  skin: string
  beard: string
  intro: string
  bank: string
  bust: string
  story: string
}

const fair = (special: string[] = []) => [...special, ...Array<string>(6 - special.length).fill('standard')]

export const OPPONENTS: OpponentDefinition[] = [
  { id: 'mara', name: '玛拉', title: '铜币商人', seat: '窗边桌', difficulty: 'conservative',
    loadout: fair(['lucky-five']), color: '#477b6c', skin: '#cf9672', beard: '#382822',
    intro: '一枚进了口袋的铜币，胜过十枚许诺。', bank: '记账。小赚也是赚。', bust: '这笔……划掉。',
    story: '玛拉总把第一枚赢来的铜币留在衣袋里。那是她第一次独自穿过北方商路的路费。' },
  { id: 'osric', name: '奥斯里克', title: '退役卫兵', seat: '炉火桌', difficulty: 'normal',
    loadout: fair(['odd-fellow']), color: '#647786', skin: '#bc8669', beard: '#c0b9a2',
    intro: '先看清退路，再往前一步。', bank: '到这里就够了。收队。', bust: '年轻时，我也判断错过。',
    story: '奥斯里克已经不再守城。他仍然每晚坐在能看见门口的位置，把背后留给炉火。' },
  { id: 'rue', name: '露', title: '游荡赌客', seat: '烛影桌', difficulty: 'aggressive',
    loadout: fair(['high-roller', 'joker']), color: '#93516a', skin: '#dda787', beard: '#282533',
    intro: '故事里可没人记得提前收手的人。', bank: '替我收着。下一把还要用。', bust: '好吧，这一段别写进歌里。',
    story: '露从不说自己来自哪里。她的骰盅底部刻着五座城市的名字，第六个位置还空着。' },
  { id: 'keeper', name: '布兰', title: '歪皇冠老板', seat: '皇冠桌', difficulty: 'normal',
    loadout: fair(['odd-fellow', 'high-roller']), color: '#806039', skin: '#b88260', beard: '#463027',
    intro: '最后一桌。让我看看你今晚学到了什么。', bank: '这局账，我算得很清楚。', bust: '酒馆里，谁都有走运和失手的时候。',
    story: '布兰赢过一顶真正的皇冠，又用它换了这间酒馆。他说这里每天都有更好的故事。' },
]

export function opponentAt(table: number): OpponentDefinition {
  return OPPONENTS[Math.max(0, Math.min(3, table))]
}
