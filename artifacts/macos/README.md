# Mac 应用归档

`Tavern-Bones-mac-arm64.zip` 是当前 Apple Silicon Mac 应用，通过 Git LFS 与源码一起提交。`manifest.json` 记录本包对应的游戏源码提交、压缩包与 `app.asar` 的 SHA-256。

下载仓库中的 ZIP 并解压，即可获得 `Tavern Bones.app`。克隆仓库时需要 Git LFS：

```bash
git lfs install --local
git lfs pull
ditto -x -k artifacts/macos/Tavern-Bones-mac-arm64.zip /private/tmp/tavern-bones-unpacked
codesign --verify --deep --strict '/private/tmp/tavern-bones-unpacked/Tavern Bones.app'
shasum -a 256 artifacts/macos/Tavern-Bones-mac-arm64.zip
```

应用的用户数据独立保存在 `~/Library/Application Support/Tavern Bones/`，不包含在归档中。替换应用保留此目录，已有游戏进度会继续使用。

更新归档时：

1. 通过项目测试、lint 和构建，提交游戏源码以确定来源提交。
2. 运行 `npm run desktop:package`，更新默认路径的 `.app`。
3. 使用下面的命令归档，更新清单，并解压验证签名与包内构建资源。
4. 将 `dist/`、归档、清单和本次其他成果提交、推送；核对远程提交及 LFS 对象。

```bash
ditto -c -k --sequesterRsrc --keepParent \
  'release/mac-arm64/Tavern Bones.app' \
  artifacts/macos/Tavern-Bones-mac-arm64.zip
```

展开的 `release/` 与 ZIP 表示同一份应用，只对 ZIP 进行版本控制。归档采用现有本地 ad-hoc 签名，未经过 Apple 公证。
