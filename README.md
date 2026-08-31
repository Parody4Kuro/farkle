# Tavern Bones

原创中世纪酒馆风格的单机骰子游戏。玩家与三种策略风格的 AI 轮流掷骰，在每次投掷后选择合法计分骰，决定继续冒险或保存分数；率先达到目标分数的一方获胜。游戏包含程序化 Web Audio 音效，无需下载音频素材。

## 启动

```bash
npm install
npm run dev
```

浏览器打开终端显示的本地地址（默认 `http://localhost:5173`）。

## 验证

```bash
npm test
npm run lint
npm run build
```

## 结构

- `src/game/`：计分组合搜索、骰子、AI、规则、纯状态转换、Modifier 与类型
- `src/hooks/useDiceGame.ts`：玩家/AI 流程编排与异步时序
- `src/storage/`：设置、统计和音效偏好的容错本地存储
- `src/audio/`：惰性初始化的程序化 Web Audio 音效引擎
- `src/components/`：骰子桌面、计分板、操作区、规则、设置和结算界面
- `src/**/*.test.ts(x)`：计分、七骰边界、状态机、存储、音效与关键组件测试

设置、骰子配置、AI 难度、目标分数、胜负统计和音效偏好保存在浏览器 `localStorage` 中。规则设置只在开始新游戏时写入对局快照，不会改变正在进行的游戏。
