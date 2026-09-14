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
  - `state.ts`：纯 `gameReducer` 与显式领域事件；规则状态转换应优先放在这里。
  - `types.ts`：跨模块共享的领域类型。
- `src/hooks/useDiceGame.ts`：玩家与 AI 流程编排、异步动画时序和音效触发。
- `src/storage/gameStorage.ts`：设置、统计、音效偏好的验证、归一化和容错读写。
- `src/audio/gameAudio.ts`：程序化 Web Audio 音效；不得依赖外部受版权保护的音频素材。
- `src/components/`：展示和用户交互组件，不应重新实现核心规则。
- `src/**/*.test.ts(x)`：核心逻辑、存储、音效和关键组件测试。

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
10. 同点数组合最多使用 6 颗骰子。Loaded Hand 产生第 7 颗骰时，不得把七同作为新计分档，也不得把同一面值拆成多个同点数组合来绕过上限；单独可计分的 1 或 5 仍可另行计分。

## 实现注意事项

- 核心规则保持纯函数，禁止从 `src/game/` 访问 React、DOM 或 `localStorage`。
- 所有骰子随机结果必须通过 `weights` 加权抽样；不要直接用 `Math.random() * 6` 替代。
- 新 Modifier 优先通过 `GameModifier` 回调、`activation`、`useLimit` 与通用 `ModifierUsage` 接入，避免把徽章名称硬编码进计分器或 Hook。
- AI 必须先选择当前投掷的最佳合法拆分，再根据临时分、剩余骰数、比分、目标差距与难度判断继续或 Bank。
- AI 和玩家投掷都包含可观察延迟。修改异步流程时必须维护 `runId` 取消保护，确保“开始新游戏”后旧定时任务不会污染新状态。
- 设置、统计和音效偏好分别使用 `localStorage`：`tavern-bones-settings-v1`、`tavern-bones-stats-v1` 和 `tavern-bones-audio-v1`。改变结构时要考虑旧数据容错。
- 设置面板编辑的是下一局草稿；开始游戏时必须深拷贝为 `state.config`，不得让设置修改中途改变当前目标分、骰组、AI 难度或 Modifier。
- 音效默认开启、主音量 60%，只在用户手势后初始化 `AudioContext`；页面隐藏时挂起，不支持 Web Audio 或播放失败时必须静默降级，不能影响玩法。
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

## 生成内容、提交与远程同步（用户长期授权）

- 用户已要求：本项目今后每次工作产生或修改的代码、文档、图片、验收报告、网页构建与 Mac 应用等项目成果，都需要验证、提交并推送到 GitHub 远程仓库。不要仅留在本地，也不要重复询问提交与推送许可。分支由执行者根据上下文决定。
- `dist/` 纳入版本控制。正式报告、图片与其他生成成果放入受版本控制的 `docs/` 或 `artifacts/`。
- Mac 应用必须重新打包；仅更新源码、运行 `npm run build` 或推送代码不会更新现有 `.app`。交付前检查应用包与最新构建一致，保留稳定的应用路径和用户存档。
- 将最新 `release/mac-arm64/Tavern Bones.app` 用 macOS `ditto` 归档到 `artifacts/macos/Tavern-Bones-mac-arm64.zip`，保留应用结构、符号链接与签名。更新同目录的 `manifest.json`，记录应用来源提交和 SHA-256；验证归档解压后签名及包内资源。
- Mac 归档通过 Git LFS 提交；仓库级启用 `git lfs install --local`，提交 `.gitattributes`。推送后确认普通 Git 提交与 LFS 对象都已到达远程，并报告提交及下载入口。
- `release/` 是已归档应用的展开目录，不重复跟踪同一应用的展开副本。依赖安装、可再生缓存、临时诊断文件、机器编辑器文件，以及玩家个人存档和凭据不属于交付成果，不加入仓库；正式验收结论和所需证据应保存到受版本控制的目录。
- 保留与任务无关的用户改动，不执行破坏性 Git 操作。
- 提交信息使用简洁的英文 Conventional Commit 风格，例如 `feat: add tavern dice game` 或 `fix: preserve turn state after hot dice`。
