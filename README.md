# OpenQuota 简体中文版 · Codex 用量提醒器

[![Latest release](https://img.shields.io/github/v/release/lyc77215-a11y/OpenQuota-zh?display_name=tag&sort=semver)](https://github.com/lyc77215-a11y/OpenQuota-zh/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078d4?logo=windows&logoColor=white)](https://github.com/lyc77215-a11y/OpenQuota-zh/releases/latest)
[![License](https://img.shields.io/github/license/lyc77215-a11y/OpenQuota-zh)](LICENSE)

一个常驻 Windows 桌面的 Codex 用量小浮窗：不用切换页面，就能查看 5 小时额度、每周额度、重置时间、Token 明细和费用估算。

这是基于 [deviffyy/OpenQuota](https://github.com/deviffyy/OpenQuota) v0.4.2 的中文定制分支，保留原项目 MIT 许可。它是社区项目，与 OpenAI 官方没有隶属、授权或合作关系。

## 先看重点

| 你想知道什么   | OpenQuota 简体中文版能做什么                                  |
| -------------- | ------------------------------------------------------------- |
| 额度还剩多少   | 同时显示 5 小时和每周额度、使用节奏与重置时间                 |
| 今天用了多少   | 展开查看今日、本轮重置后及本机可发现的历史 Token              |
| Token 怎么组成 | 区分 cached、input、output；input 会扣除 cached，避免重复计数 |
| 大概花了多少钱 | 提供美元与人民币费用估算，并可展开查看明细                    |
| 是否有重置券   | 显示可用重置券；真正提交前还需要再次确认                      |
| 是否打扰工作   | 轻量圆角浮窗，可拖动、常驻桌面，默认每 5 分钟刷新             |

## 为什么是这个分支

- 面向中文 Windows 用户，安装和界面提示均为简体中文。
- 在原版用量展示基础上，补充更直观的 Token 分类、费用估算和重置券确认。
- 默认关闭开机启动和自动检查更新，减少后台行为；需要时可在设置中开启。
- 重点说明数据来源和边界：历史用量、汇率和费用都可能只是本机可见或程序估算值。

## 下载与安装

**[下载最新 Windows x64 安装包](https://github.com/lyc77215-a11y/OpenQuota-zh/releases/latest)**

1. 在 Release 的 Assets 中下载带有 `zh-CN` 和 `x64` 的 Windows 安装包。
2. 在 Windows 10/11 x64 上运行安装程序；系统需要 Microsoft Edge WebView2 Runtime。
3. 先在本机 Codex 中使用自己的 ChatGPT 账户登录，再打开 OpenQuota。
4. 点击刷新读取额度，点击浮窗展开查看 Token 和费用明细。

如果 Windows 显示“未知发布者”或 SmartScreen 提示，这是因为当前安装包尚未使用 Authenticode 签名。请只从本仓库 Release 下载，并用发布页提供的 SHA-256 校验值核对文件；不要安装来历不明的重新打包版本。

## 使用前请知道

- 程序使用你本机已有的登录凭据向对应服务查询额度，并读取本地用量日志；仓库和安装包不包含发布者的账号、令牌、个人日志或用量数据库。
- Token 历史取决于本机可读取的日志，不代表账户跨设备的完整历史。
- 美元和人民币金额是按程序内价格与汇率口径计算的估算值，不是实际账单。
- 重置券操作需要你自己的账户确实有可用重置券；程序不会购买、赠送或生成重置券，是否成功由服务端决定。
- 仅 API Key 登录不支持 ChatGPT 订阅额度查询。

## 更新

在设置中检查更新，或直接打开[最新 Release](https://github.com/lyc77215-a11y/OpenQuota-zh/releases/latest)。更新功能和发布页均指向本中文分支；如果你使用旧版安装包，请不要用原版 OpenQuota 安装包覆盖它。

当前定制版只发布 Windows x64 安装包，未验证 macOS、Linux 或 Windows ARM64。安装包未签名，但自动更新下载仍会校验更新签名；遇到无法自动更新的情况，请从 Release 手动下载并核对 SHA-256。

完整的版本记录见 [CHANGELOG.md](CHANGELOG.md)。

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

打包配置要求 `src-tauri/target/release/WebView2Loader.dll`。如使用 GNU/MinGW 工具链，请将同一工具链生成的 x64 `WebView2Loader.dll` 放到该位置；不要使用来源不明的 DLL。

## 反馈与贡献

遇到问题时，请优先使用[问题反馈模板](https://github.com/lyc77215-a11y/OpenQuota-zh/issues/new?template=bug_report.yml)；有功能建议可以提交[功能建议](https://github.com/lyc77215-a11y/OpenQuota-zh/issues/new?template=feature_request.yml)。

反馈前请提供 Windows 版本、系统架构、OpenQuota 版本和复现步骤。请务必先删除账号、令牌、账户标识符和未经检查的日志内容。安全漏洞请按照 [SECURITY.md](SECURITY.md) 私下报告，不要公开创建 Issue。

## 致谢与许可

原项目由 [deviffyy 和 OpenQuota contributors](https://github.com/deviffyy/OpenQuota) 开发，并受到 [OpenUsage](https://github.com/robinebers/openusage) 启发。本分支增加中文桌面体验和定制用量展示。

源码使用 [MIT License](LICENSE)，允许在保留许可与版权声明的前提下使用、修改和分发。
