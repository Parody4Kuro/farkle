# Tavern Bones

原创中世纪酒馆风格的单机骰子游戏，支持本地浏览器和独立 Mac 应用。包含第一人称“四桌一夜”冒险，以及保留自由配置与独立统计的经典对局。所有人物、场景、骰面和声音由本项目代码原创生成。

## 下载与文档

- **[下载最新 Mac 版本](https://github.com/Parody4Kuro/farkle/releases/latest)**：在 Release 的 Assets 中下载 `Tavern-Bones-mac-arm64.zip`，解压后将 `Tavern Bones.app` 拖入“应用程序”。适用于 Apple Silicon（M 系列芯片）；无需克隆仓库或安装开发工具。
- [更新记录](CHANGELOG.md) · [文档目录](docs/README.md) · [Mac 安装与升级说明](artifacts/macos/README.md)
- `src/` 保存游戏源码，`desktop/` 保存桌面壳，`dist/` 保存最新网页构建，`artifacts/macos/` 保存最新 Mac 归档与校验文件。历史发布包通过 GitHub Releases 保留。

## 酒馆之夜

- 选择已解锁的六骰起始套装，再从三个核心徽章中选一个，第一桌即可尝试不同打法。依次挑战铜币商人玛拉、退役卫兵奥斯里克、游荡赌客露和老板布兰；三桌普通局目标 2000 分，老板桌目标 4000 分。
- 核心占一个徽章位，同时最多装备两枚徽章、其中最多一个核心。铜筹账簿强化单骰但削弱组合，同契纹章强化同点组合但削弱单骰与顺子，歧路罗盘强化顺子与 Joker 同点组合但削弱普通同点组合。
- 首次失利消耗一次容错，保留装备并在同一桌整备重试；累计两败结束当夜。失败不发奖励，最多进行五场对局。
- 普通桌胜利后从三个奖励中选一件收入本夜行囊，也可放弃。换下的物品仍保留；同名骰子按实际持有颗数装备，徽章不重复持有。
- 每桌和重试入座前，通过六个骰位、两个徽章位重新搭配；确认入座后本桌配置固定。满载之手的第七颗骰只在回合中生成。
- 每位对手的骰组和风格都公开。老板根据比分调整风险偏好；所有 AI 使用真实加权骰子，先选最高合法分数，再决定继续或落袋。
- 选择后可查看计分组合、Joker 替代、徽章加成和可保存总分。下一投爆骰概率按实际剩余骰组精确计算；Hot Dice 按恢复后的完整骰组计算，护符重投保护单独显示。
- 入座面对角色，游戏时俯身看桌面，也可手动切换。四位原创几何角色共用动作，通过服装、面部与姿态区分。投骰保留真实物理轨迹与原有 2D 降级。
- 酒馆之夜偏好支持快速演出、关闭人物对白、较大字号、独立环境与音乐音量。声音只在用户交互后启动。
- 失焦、隐藏、最小化或打开规则/偏好面板时，骰子演出、AI、等待时间和声音一起暂停。回到窗口、关闭面板后需手动点击“继续”，也可以随时主动暂停。
- 完成第一夜解锁“商路旧识”，首次通关解锁“夜行旅人”和月下骰盅。遇到的人物留下轶事，结算记录本夜装备、最大落袋和最大爆骰损失。没有永久数值升级。

每次状态变化同步保存到本机。已经抽出的骰子、待完成的演出、AI 流程、随机状态、行囊和奖励选择都会保留；刷新后从酒馆选择“继续这一夜”，再点击“继续”。关闭应用后恢复可以重播同一次演出，不能重新抽取结果。回到酒馆会取消当前异步任务，开始新冒险会替换当夜存档，收藏保留。

键盘可用 Tab / Shift+Tab 移动焦点，空格选择骰子，回车触发按钮；整备下拉框支持按选项前的数字快速选择。macOS Safari/WebKit 默认设置下，使用 Option+Tab 可把按钮纳入导航。

不设一夜总时长目标，按自己的节奏思考与观看演出。核心参数及模拟比较见 [构筑验证记录](docs/build-validation.md)；模拟结果与个人试玩体验分开记录。商店、悬赏、分支事件、每日挑战和专门的触屏交互仍是后续扩展。

## 启动

### Mac 应用（Apple Silicon）

从 [GitHub Releases](https://github.com/Parody4Kuro/farkle/releases/latest) 下载并解压应用即可进入酒馆，也可以将它拖入“应用程序”或固定到 Dock。应用包含全部运行资源，游玩时不需要 Node.js、终端、Vite 服务或网络。从源码打包的应用位于 `release/mac-arm64/Tavern Bones.app`。

仓库同时保存[最新版 Mac 应用 ZIP](artifacts/macos/Tavern-Bones-mac-arm64.zip)与[校验清单](artifacts/macos/manifest.json)。ZIP 通过 Git LFS 跟踪；克隆后执行 `git lfs pull` 获取应用，详见[应用归档说明](artifacts/macos/README.md)。网页构建 `dist/` 也随源码提交。今后本项目的生成成果在验证后统一提交并推送。

当前 arm64 应用使用 ad-hoc 签名，尚未配置 Developer ID 签名与 Apple 公证。下载后 macOS 可能阻止首次打开，处理方法见[安装说明](artifacts/macos/README.md)。

- 使用标准 Mac 窗口与菜单，支持全屏、最小化和 `⌘Q`；关闭窗口后点击 Dock 可以重新打开。
- 失焦、最小化或隐藏窗口时暂停整个对局；恢复窗口后手动继续。游戏使用只读焦点和可见性通知，同时兼容浏览器生命周期事件。
- 桌面版从独立的新存档开始，数据保存在 `~/Library/Application Support/Tavern Bones/`，其中 Chromium 会话数据位于 `Chromium/` 子目录。应用移动或替换升级不会移动或删除这些数据。
- 冒险保留当前的同步保存与中断恢复；经典模式继续只保存设置和统计。首版没有浏览器存档迁移、联网账户或自动更新。

从源码生成应用（首次准备 Electron 运行时需要联网）：

```bash
npm install
npm run desktop:package
```

开发与桌面验证：

```bash
npm run desktop:dev
npm run test:desktop
```

`desktop:dev` 构建当前代码后在 Electron 中打开；修改代码后重新运行即可。`test:desktop` 先重新打包，再对真实 `.app` 执行离线、物理 Worker、窗口、音效、存档和完整四桌流程测试，测试数据独立保存在被忽略的 `test-results/desktop/`。

桌面壳使用 Electron 和 electron-builder；固定的 `tavern://game/` 源提供包内资源，不启动 HTTP 服务。渲染器保留沙箱、上下文隔离和 Web 安全，预加载接口仅提供窗口可见性和焦点状态，无法访问文件系统或任意 IPC。原创骰子图标由 `npm run generate:icon` 使用 macOS AppKit 和 iconutil 重建。

### 浏览器

```bash
npm install
npm run dev
```

浏览器打开终端显示的本地地址（默认 `http://localhost:5173`）。所有美术、骰面及音效均由本项目代码原创生成，没有远程素材、字体或音频依赖。

## 验证

```bash
npm test
npm run lint
npm run build
```

浏览器验证使用构建后的应用，覆盖物理落点、键盘选骰、七骰与连续 Hot Dice、Joker 与能力、WebGL/Worker 失败回退，以及三个桌面尺寸：

```bash
npx playwright install firefox webkit
npm run build
npm run test:browser
# 也可只使用已安装的 Chrome
npm run test:browser -- --project=chrome
```

Chrome 和 Edge 项目使用本机安装的浏览器；Firefox 和 WebKit 使用 Playwright 测试引擎。WebKit 引擎测试不等于发行版 Safari 的人工验收。截图和失败时的 trace 保存在被 Git 忽略的 `test-results/`。

## 3D 与玩法如何协作

- `src/game/` 继续负责加权抽样、合法选择、计分、AI 和状态转换，不依赖渲染器或浏览器。`adventure.ts` 在单局 reducer 外管理四桌冒险，`opponents.ts` 提供对手配置，`risk.ts` 用骰面计数分布与同一组合法组合规则计算精确概率。
- `useDiceGame` 在投掷开始时抽取一次结果，再等待可注入的 `presentRoll(request, signal)`。玩家、AI 和护符重投共用这一接口；演出结束后才提交 `ROLL_RESOLVED`。新局与卸载取消旧演出；暂停保留等待，演出保护超时只累计实际运行时间。
- `src/presentation/GamePlayback.ts` 为两种模式、演出、场景和音效提供统一暂停与运行时钟。暂停后的 Worker 结果或 WebGL 降级也需等到继续后才能提交。
- `src/game/selection.ts` 让预览、锁定、落袋和能力使用共享判断。DFS 比较装备生效后的合法组合收益；黄金一点可以修改单颗未计分骰，孤注一掷后选择和骰值冻结。
- `src/presentation/` 连接游戏与可选的渲染器，并从明确领域事件产生漫画反馈，不解析消息文案。
- `src/scene/` 使用 Three.js 和 React Three Fiber 绘制原创几何、六面骰子、卡通材质、轮廓与光影。HTML 按钮投影到骰子位置，承担鼠标、键盘、焦点和读屏语义。
- `src/scene/physics/` 在 Worker 中使用 Rapier 以 120 Hz 预演碰撞，60 Hz 记录轨迹，播放时插值。运动使用独立随机源，不消耗或修改游戏的随机结果。
- `useAdventure` 先同步持久化抽样结果，再交给同一个可取消演出接口。恢复时继续待完成结果，不进行第二次抽样；revision、runId 和 AbortSignal 防止过时任务提交。
- 第一人称使用透视镜头和屏幕投影点击区域。`scene/camera.ts` 同时提供镜头参数与落点投影校验，备用轨迹已重新生成，需同时通过经典与第一人称的间距约束。

物理预演确认落地面后，为骰子模型选择一个从第一帧就固定的立方体对称旋转。六面关系始终一致，落地面与加权结果匹配；没有落地后替换纹理或重新抽点数。一个轨迹最多模拟 3 秒，最多尝试 3 次，后台准备预算为 700 毫秒。失败时播放随包提供的、同样来自真实物理模拟的已验证轨迹。

重新生成 1～7 骰的备用轨迹：

```bash
npm run generate:trajectories
npm test
```

备用轨迹由固定种子生成，测试会检查每颗骰子的落地朝向、高度、边界及投影间隔。修改骰子尺寸、碰撞边界或相机投影关系时，应同步调整落点验证并重新生成。

## 显示与降级

桌面浏览器为主要目标，适配 1280×720、1920×1080 与超宽屏。3D 和物理模块按需加载，渲染像素比最高 1.5；静止场景按需绘制，页面隐藏时停止绘制和音效。减少动态效果模式直接显示落定姿态，关闭翻滚与飞字运动。

WebGL 不可用、上下文丢失或 3D 模块加载失败时，自动使用可键盘操作的简约桌面。Worker 不可用时仍可使用 3D 备用轨迹。两种降级均保留规则、特殊骰、AI、音效偏好和统计。计分托盘最多显示最近 7 颗锁定骰，完整历史可展开查看。

生产环境应为静态 JS、JSON 和 Worker 资源开启 HTTP 压缩与缓存。物理引擎随 Worker 加载，不需要服务器参与计算。

## 结构

- `src/game/`：计分组合搜索、骰子、AI、规则、纯状态转换、Modifier 与类型
- `src/hooks/useDiceGame.ts`：玩家/AI 流程编排与异步时序
- `src/presentation/`：可取消的掷骰演出接口与领域事件反馈
- `src/scene/`：卡通 3D 场景、物理 Worker、备用轨迹与骰面朝向
- `src/storage/`：设置、统计和音效偏好的容错本地存储
- `src/audio/`：惰性初始化的程序化 Web Audio 音效引擎
- `src/components/`：计分板、操作区、规则、设置和结算界面
- `src/**/*.test.ts(x)`：计分、状态机、存储、音效、演出取消与物理轨迹测试
- `e2e/`：真实浏览器中的对局、故障回退与布局验证

设置、骰子配置、AI 难度、目标分数、胜负统计和音效偏好保存在浏览器 `localStorage` 中。规则设置只在开始新游戏时写入对局快照，不会改变正在进行的游戏。升级保留现有的三套存储键与数据格式；经典胜负统计不会计入冒险对局。

冒险使用 `tavern-bones-adventure-v2`（当夜状态、规则版本与暂停检查点）、`tavern-bones-profile-v1`（幂等结算与收藏）、`tavern-bones-comfort-v1`（体验偏好）。缺少 v2 时自动迁移旧 `tavern-bones-adventure-v1`，保留旧键作为备份；只重建旧档确实持有的装备，不补发核心，也不倒退已跳过的桌子。迁移后的下一次失败采用同桌重试规则。

存在但损坏的 v2 不会回退到旧进度；界面提示无法恢复，并保留新冒险和经典模式入口。存储失败不打断当前内存中的游戏。经典模式保留原有自由配置、四种普通徽章和独立统计，新核心仅在冒险中提供。
