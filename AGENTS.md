# AGENTS.md

## 项目定位

本项目是一个完全运行在浏览器本地的原创中世纪酒馆骰子游戏 **Tavern Bones**。技术栈为 Vite、React、TypeScript 和原生 CSS，不使用后端。核心玩法参考 Farkle 类规则，但不得加入任何第三方游戏受版权保护的名称、美术、音效、Logo 或 UI 资源。

## 常用命令

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

完成代码修改后，至少运行与改动相关的测试。涉及规则、状态机、组件接口或构建配置时，提交前必须依次保证 `npm test`、`npm run lint` 和 `npm run build` 全部通过。

## 代码结构

- `src/game/`：与 React 无关的纯逻辑层。
  - `scoring.ts`：计分组合枚举、位掩码 DFS 搜索、Joker 处理和选择合法性校验。
  - `dice.ts`：数据驱动的骰子定义和加权随机。
  - `ai.ts`：AI 最优选骰与风险决策。
  - `modifiers.ts`：可扩展 Modifier 定义及分派函数。
  - `rules.ts`：目标分、Bank、Hot Dice 和风险提示等通用规则。
  - `types.ts`：跨模块共享的领域类型。
- `src/hooks/useDiceGame.ts`：玩家与 AI 回合状态机、异步动画时序、本地存档。
- `src/components/`：展示和用户交互组件，不应重新实现核心规则。
- `src/game/*.test.ts`：核心逻辑测试。

## 核心规则约束

1. 默认每回合使用 6 颗骰子，默认目标分为 4000；两者应保持容易配置。
2. 单颗 1 得 100，单颗 5 得 50；三同及更多、两种五骰顺子和六骰大顺按现有规则计分。
3. 每次选择只能使用本次新投出的骰子。已锁定骰不能和后续投掷重新组成三同、顺子或其他组合。
4. `validateSelectedDice` 必须验证所有选中骰都被合法计分组合完整消费。不能仅用“最高分大于 0”判断合法性。
5. 计分搜索应继续使用合法组合枚举与 DFS/backtracking；不要改回按条件顺序硬编码的贪心算法。
6. Joker 面本身没有固定单骰分数，只能替代组合中的点数；计算时应寻找最高分合法替代方案。
7. 新投掷完全无合法计分方式时立即 Bust，清空本回合临时分，但不得影响已经 Bank 的总分。
8. 当前可用骰全部成功计分后触发 Hot Dice，并在同一回合重新获得完整骰组；之后 Bust 仍会丢失该回合全部临时分。
9. Bank 必须包含当前投掷中的合法选择，不能在看过新投掷后忽略它并只保存此前临时分。

## 实现注意事项

- 核心规则保持纯函数，禁止从 `src/game/` 访问 React、DOM 或 `localStorage`。
- 所有骰子随机结果必须通过 `weights` 加权抽样；不要直接用 `Math.random() * 6` 替代。
- 新 Modifier 优先通过 `GameModifier` 回调或 `activeAbility` 分派接入，避免把徽章名称硬编码进计分器。
- AI 必须先选择当前投掷的最佳合法拆分，再根据临时分、剩余骰数、比分、目标差距与难度判断继续或 Bank。
- AI 和玩家投掷都包含可观察延迟。修改异步流程时必须维护 `runId` 取消保护，确保“开始新游戏”后旧定时任务不会污染新状态。
- 设置与统计使用 `localStorage`：`tavern-bones-settings-v1` 和 `tavern-bones-stats-v1`。改变结构时要考虑旧数据容错。
- UI 应保留深色木桌、羊皮纸、铜色强调的原创风格。骰子选中、锁定、Rolling、Bust、Hot Dice 和胜利状态都需要清晰反馈。
- 保持键盘焦点样式、按钮语义、`aria-label`/`aria-live` 和 `prefers-reduced-motion` 支持。
- 不要引入后端或大型状态管理依赖；当前规模优先使用 React 状态、Hook 和纯函数。

## 测试要求

修改计分或特殊骰时，应补充以下类型的测试：

- 单骰、多个单骰、三至六同、两种五骰顺子和六骰顺子。
- 多组合最优拆分、Bust、部分选择和非法混选。
- Joker 参与同点数及顺子。
- 不能跨投掷组合、Hot Dice、Bank 和多轮累计。
- 加权随机边界、AI 风格差异和 Modifier 分派。

不要为了让测试通过而缩窄正式规则；测试应覆盖游戏真实行为。

## 提交约定

- 不提交 `node_modules/`、`dist/`、日志或本地编辑器文件。
- 保留与任务无关的用户改动，不执行破坏性 Git 操作。
- 提交信息使用简洁的英文 Conventional Commit 风格，例如 `feat: add tavern dice game` 或 `fix: preserve turn state after hot dice`。
