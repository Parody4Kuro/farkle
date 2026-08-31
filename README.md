# Tavern Bones

原创中世纪酒馆风格的单机骰子游戏。玩家与三种策略风格的 AI 轮流掷骰，在每次投掷后选择合法计分骰，决定继续冒险或保存分数；率先达到目标分数的一方获胜。

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

- `src/game/`：计分组合搜索、骰子、AI、规则、Modifier 与类型
- `src/hooks/useDiceGame.ts`：完整游戏状态机、AI 时序和本地存档
- `src/components/`：骰子桌面、计分板、操作区、设置和结算界面
- `src/game/*.test.ts`：计分、Joker、规则、AI 和加权骰测试

设置、骰子配置、AI 难度、目标分数和胜负统计保存在浏览器 `localStorage` 中。
