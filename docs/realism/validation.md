# 写实场景与沉浸动画验收

日期：2026-09-29。运行资源全部本地；代码、网页构建、资产源文件、证据与 Mac 包一同交付。

## 实现范围

- 四位人物和玩家双手：官方 MakeHuman CC0 基础资产，Blender 4.5.14 / MPFB 2.0.17 改造；每套 53 关节、9 条原创建模动作，包含手指、表情和角色动作差异。按桌加载 GLB，保留带贴图与骨架的 `.blend`。
- 骨质凹陷点孔骰、木桌、皮革杯、铜件、布料与本地 HDR。骰子边长 0.032 m，物理、道具和相机共用尺寸。
- 摇杯 → 连续出骰 → Rapier 翻滚 → 150 ms 选骰反馈 → 收入托盘 / 落袋 / Hot Dice / 爆骰 / 能力 / 胜负。最终落袋先完成数字入账，再播放角色胜负反应和结算界面。
- 三种模式共用动作前后显示快照、暂停时钟、跳过、快速演出、电影镜头开关、减少动态效果与自动 / 高 / 低画质。已有快速偏好保留，系统减少动态效果优先。
- 好友动作摘要可选、按序去重；房主裁定独立于演出。不同演出速度、后台房主、断线重连与再开局均有真实双端测试。
- 骰子结果和分数仍来自原规则与加权随机；演出完成只释放流程。刷新使用已保存结果，runId / revision / AbortSignal 阻止旧任务回写。

## 验证记录

- `npm test`：32 文件、196 项全部通过。
- `npm run lint`：通过。
- `npm run build`：通过。Three/Rapier 分包仍产生体积提示；按需加载，未隐藏该提示。
- Chrome：28 个浏览器用例均已覆盖并通过（27 个整套通过，录制用例在稳定构建后单独复验通过）。期间发现并修复镜头结束时点击区域沿用旧相机矩阵的问题。一次录制遇到打包清空 dist 的短暂 404，属于验证任务同时读写产物；后续构建和浏览器验收顺序执行。
- 单测覆盖动作去重、暂停音效、取消、新局、只入账一次、旧偏好迁移、好友摘要与七骰 Hot Dice；保留原计分 / Joker / 核心徽章 / 不能跨投掷组合 / 连续 Hot Dice 回归。
- 浏览器覆盖 1280×720、1920×1080、2560×1080；控制区无水平溢出，骰子点击区域至少 42 px，键盘路径、减少动态效果、Worker / WebGL / 模型缺失降级可玩。
- 真实 Mac 应用：9 项完整用例全部通过；最终特殊骰雕纹构建另复验离线七骰、音效与性能。覆盖应用重启、物理投掷中退出、AI 入账中退出、奖励恢复、关闭窗口 / Dock / 单实例、移动替换应用保留数据、完整四桌、失焦与最小化、真实 Mac ↔ 浏览器好友对局。
- 1080p 原生渲染器内容视口复验通过：无 JS 异常、无远程模型 / 贴图请求，WebGL / GPU 合成启用。

## 性能口径

`browser-metrics.json` 与 `mac-metrics.json` 为真实运行记录。完整投掷探针记录可见 roll 期间的 requestAnimationFrame 间隔，包含超过 33 / 100 ms 的长帧。生产画质调节器另记录最近 180 帧的活动帧统计，忽略超过 100 ms 的静止 / 切换间隔；验收以完整探针为准。数字表示一轮实际采样，不代表所有机器和所有局面。录屏与截图本身也有开销。

## Apple M4 / 16 GB 实测

| 场景 | 实际内容视口 | 帧间隔中位数 | P95 | 最大单帧 | 资源 |
|---|---|---:|---:|---:|---|
| Chrome 首桌，自动画质，DPR 1 | 1920×1080 | 16.7 ms | 16.7 ms | 16.8 ms | JS 堆约 67.7 MiB |
| Mac 应用，自动画质，DPR 1 | 1920×1080 | 16.7 ms | 16.8 ms | 166.6 ms | 各进程工作集合计约 1.13 GiB |

浏览器投掷用时 3.222 秒，完整探针 173 帧，无 >33.4 ms 长帧。Mac 探针 165 帧，有 1 帧 >100 ms，发生于首次场景 / 投掷加载阶段；本次未消除此冷启动长帧，稳定演出接近 60 Hz。采样区间 4.222 秒（含截图），累计 CPU 3.168 秒，约为单核 75.0%；工作集合计可能重复计算共享页，不等于独占物理内存。

内置屏幕将原生窗口限制为 1470×891 CSS 像素，因此 1080p 检查通过 CDP 固定**真实 Mac 应用 WebContents** 的内容视口，GPU 仍是本机硬件；没有改变系统显示设置。未经覆盖的原生窗口也已实测并保存到 [原生显示记录](../../artifacts/realism/mac-native-display-metrics.json)。[1080p Mac 实机截图](../../artifacts/realism/mac-1080.png)、[Mac 原始数据](../../artifacts/realism/mac-metrics.json)、[浏览器原始数据](../../artifacts/realism/browser-metrics.json)可复核。

## 实际画面与录像

- [首桌真实加权投掷、选骰、继续与落袋](../../artifacts/realism/first-table.webm)
- [七骰 Hot Dice 与黄金一点](../../artifacts/realism/hot-sequence.webm)
- [爆骰](../../artifacts/realism/bust-sequence.webm) · [最终入账与胜负](../../artifacts/realism/victory-sequence.webm)
- [玛拉](../../artifacts/realism/mara-portrait.png) · [奥斯里克](../../artifacts/realism/osric-portrait.png) · [露](../../artifacts/realism/rue-portrait.png) · [布兰](../../artifacts/realism/keeper-portrait.png)
- [720p 桌面](../../artifacts/realism/table-1280.png) · [1080p 桌面](../../artifacts/realism/table-1920.png) · [超宽屏](../../artifacts/realism/table-2560.png)
- [杯口与手部](../../artifacts/realism/cup-contact.png) · [收骰](../../artifacts/realism/collect-contact.png) · [飞入实际计分板](../../artifacts/realism/bank-credit.png)

首桌录像来自 seed 57 的实际加权流程。Hot Dice / 爆骰 / 胜利片段使用隔离的已抽取存档夹具，随后通过真实界面和规则推进，便于稳定复现罕见状态；不会进入玩家存档。WebM 记录画面，不含音轨。程序音效的暂停、接触时点和一次触发由时钟测试及真实应用 AudioContext 生命周期检查验证。

## 资产、授权与重建

[资产说明](../../artifacts/art-source/README.md)保存官方来源、每项贴图和模型校验值、可编辑源文件与重建步骤。[MakeHuman 官方授权](https://static.makehumancommunity.org/makehuman/faq/are_makehuman_files_free.html)与 [Poly Haven 授权](https://polyhaven.com/license)均已核对；使用官方 CC0 核心 / 系统素材，不含第三方游戏资源、社区非 CC0 资产或外部音频。

当前采用实时 PBR、骨骼与接触 IK；衣料不做实时布料模拟，动作由原创关键帧与 IK 合成。性能目标是在本机 Apple Silicon 的 1080p 下保持流畅；本轮未执行其他厂商 GPU、Intel Mac 或新的发行版 Safari 验收。

## 交付核验

Mac 保持 `release/mac-arm64/Tavern Bones.app` 与独立用户数据目录。归档脚本检查解压后的严格签名、ASAR、每个 dist / desktop 资源与包版本，并记录来源提交和 SHA-256。最终结果见 [Mac 清单](../../artifacts/macos/manifest.json)与 [校验文件](../../artifacts/macos/SHA256SUMS.txt)。应用沿用 ad-hoc 签名，不新增版本标签或公开 Release。
