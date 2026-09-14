# Mac 应用归档

`Tavern-Bones-mac-arm64.zip` 是当前 Apple Silicon Mac 应用，通过 Git LFS 与源码一起提交。`manifest.json` 记录本包对应的游戏源码提交、压缩包与 `app.asar` 的 SHA-256。

## 安装与升级

1. 打开 [最新 Release](https://github.com/Parody4Kuro/farkle/releases/latest)，在 Assets 中下载 `Tavern-Bones-mac-arm64.zip`。GitHub 自动生成的 Source code 是源码归档，不是 Mac 应用。
2. 解压得到 `Tavern Bones.app`，退出正在运行的旧版本，将新应用拖入“应用程序”，替换同名应用。
3. 从“应用程序”打开游戏。此包适用于 Apple Silicon（M 系列芯片），不含 Intel 版本。

当前应用使用 ad-hoc 签名，未经过 Apple 公证。若 macOS 阻止首次打开，在尝试打开后前往“系统设置 → 隐私与安全性”，检查应用名称后选择“仍要打开”。参见 [Apple 官方说明](https://support.apple.com/en-au/102445)。

Release 同时提供 `SHA256SUMS.txt` 和 `manifest.json`。将它们与 ZIP 下载到同一目录，在该目录运行 `shasum -a 256 -c SHA256SUMS.txt` 可核对 ZIP 和清单是否完整。

直接下载 Release 附件不需要 Git LFS。克隆仓库获取受版本控制的 ZIP 时需要 Git LFS：

```bash
git lfs install --local
git lfs pull
ditto -x -k artifacts/macos/Tavern-Bones-mac-arm64.zip /private/tmp/tavern-bones-unpacked
codesign --verify --deep --strict '/private/tmp/tavern-bones-unpacked/Tavern Bones.app'
shasum -a 256 artifacts/macos/Tavern-Bones-mac-arm64.zip
```

应用的用户数据独立保存在 `~/Library/Application Support/Tavern Bones/`，不包含在归档中。替换应用保留此目录，已有游戏进度会继续使用。

## 更新与发布

更新归档时：

1. 通过项目测试、lint 和构建，提交游戏源码以确定来源提交。
2. 运行 `npm run desktop:package`，更新默认路径的 `.app`。
3. 使用下面的命令归档，更新清单，并解压验证签名与包内构建资源。
4. 将 `dist/`、归档、清单和本次其他成果提交、推送；核对远程提交及 LFS 对象。
5. 发布版本时同步 `package.json` 与锁文件的版本号，重新构建应用，补齐 `CHANGELOG.md` 和 `docs/releases/` 说明。生成 `SHA256SUMS.txt`，为最终交付提交创建 `vX.Y.Z` 标签并推送。先创建草稿 Release，上传 ZIP、清单和校验文件，核验附件后再正式发布。

```bash
ditto -c -k --sequesterRsrc --keepParent \
  'release/mac-arm64/Tavern Bones.app' \
  artifacts/macos/Tavern-Bones-mac-arm64.zip

# 更新 manifest.json 后，在 artifacts/macos/ 目录执行：
shasum -a 256 Tavern-Bones-mac-arm64.zip manifest.json > SHA256SUMS.txt
```

展开的 `release/` 与 ZIP 表示同一份应用，只对 ZIP 进行版本控制。归档采用现有本地 ad-hoc 签名，未经过 Apple 公证。
