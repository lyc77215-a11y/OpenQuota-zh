# OpenQuota 简体中文版 · 用量提醒器

一个常驻 Windows 桌面的 Codex 用量小浮窗。快速查看 5 小时和每周额度、重置时间、Token 明细与费用估算。

这是基于 [deviffyy/OpenQuota](https://github.com/deviffyy/OpenQuota) v0.4.2 的个人定制分支，保留原项目 MIT 许可。与 OpenAI 官方无隶属关系。

## 下载与安装

**[下载 Windows x64 安装包（r21）](https://github.com/lyc77215-a11y/OpenQuota-zh/releases/tag/v0.4.2-zh-r21)**

1. 在发布页的 Assets 中下载 `OpenQuota-0.4.2-zh-CN-refined-reset-x64-setup-r21.exe`。
2. 在 Windows 10/11 x64 上安装，需要 Microsoft Edge WebView2 Runtime。
3. 先在本机 Codex 中使用自己的 ChatGPT 账户登录，再打开「OpenQuota 简体中文版」。
4. 点击刷新读取额度，点击展开查看详细数据；设置中可切换桌面浮窗和开机启动。

安装包未作 Authenticode 签名，发布页同时提供 SHA-256 校验值。当前定制版仅提供 Windows x64 安装包，未验证 macOS、Linux 或 Windows ARM64。

## 定制功能

- 简体中文界面，轻薄圆角浮窗，可拖动并常驻桌面。
- 分别显示 5 小时、每周额度和使用节奏提醒。
- 展开查看今日、本轮重置后和本机可发现的历史 Token 用量。
- 点击 Token 数据查看 cached、input、output 分类；input 扣除 cached，避免重复计数。
- 展开美元与人民币费用估算，自动向下滚动展示明细。
- 显示账户可用重置券，点击「使用重置券」后须再次确认才提交请求。
- 默认五分钟刷新，默认关闭开机启动和自动检查更新。

## 数据与使用边界

程序使用使用者本机已有的登录凭据向对应服务查询额度，并读取本地用量日志。仓库和安装包不包含发布者的账号、令牌、个人日志或用量数据库。

Token 历史取决于本机可读取的日志，不代表账户跨设备的完整历史。人民币和美元金额是基于程序内价格与汇率口径的估算，不是实际账单。重置功能需要使用者自己的账户具有可用重置券；它不会购买、赠送或生成重置券，是否成功由服务端决定。仅 API Key 登录不支持 ChatGPT 订阅额度查询。

**更新请从本仓库 Releases 手动下载。** r21 默认关闭自动检查更新，但手动检查更新仍指向原版 OpenQuota；不要用原版安装包覆盖此定制版，以免丢失中文浮窗功能。

## 从源码运行

需要 Node.js 22 或更高版本、pnpm 11.11.0、Rust stable，以及 Tauri 2 的 Windows 编译依赖（C++ 构建工具和 Windows SDK）。

```powershell
git clone https://github.com/lyc77215-a11y/OpenQuota-zh.git
cd OpenQuota-zh
corepack pnpm install --frozen-lockfile
corepack pnpm tauri dev
```

前端检查和构建：

```powershell
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

Windows 安装包构建：

```powershell
cargo build --release --manifest-path src-tauri/Cargo.toml
corepack pnpm build:installer
```

此版本的打包配置要求 `src-tauri/target/release/WebView2Loader.dll`。如使用 GNU/MinGW 工具链，需将同一工具链生成的 x64 WebView2Loader.dll 放到该位置，再执行打包；安装包 r21 已包含该文件。不要使用来源不明的 DLL。原版跨平台发布工作流保留为 `docs/upstream-workflows/*.yml.example`，不自动发布此定制分支。

## 验证与反馈

本仓库保留前端测试和 Rust 测试代码。r21 原构建任务已通过前端测试、类型检查和正式安装包构建；本次公开发布额外复核前端测试、类型检查和前端构建。原构建环境中的 Rust 测试运行曾遇到 Windows GNU 系统入口点错误，未将其计为通过。

欢迎通过 Pull Request 改进。反馈问题时请隐去账户、令牌和个人用量信息。

## 致谢与许可

原项目由 [deviffyy 和 OpenQuota contributors](https://github.com/deviffyy/OpenQuota) 开发，并受到 [OpenUsage](https://github.com/robinebers/openusage) 启发。本分支增加中文桌面体验和定制用量展示。

源码使用 [MIT License](LICENSE)，允许在保留许可与版权声明的前提下使用、修改和分发。
