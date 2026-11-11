# 贡献指南

参与项目交流前，请阅读 [社区行为准则](CODE_OF_CONDUCT.md)。

使用 Node.js 22.12 或更高版本和 npm。Windows 桌面与安装包验证需要 Windows 11 x64。

```powershell
npm ci
npm test
npm start
```

提交前运行 `npm test`；修改界面时运行相应的 `test:desktop`、`test:writing-options` 或 `test:chat-search`。完整构建使用 `npm run build:win
npm run build:portable`。桌面脚本使用独立测试资料库和模拟响应，请勿在测试中使用真实密钥或研究资料。

请说明具体问题、复现步骤和预期行为。提交改动时写清变化与验证结果。保持中英文标签一致，保留 Windows 安全存储、备份排除密钥及 API 取消功能。新增第三方资源须附许可证与来源。

源码在 `src/`，自动测试在 `test/`，构建和桌面检查在 `scripts/`，本地字体与渲染资源在 `assets/`。不要提交 `node_modules/`、`tmp/`、截图中的个人资料、安装产物、API 密钥或 `%APPDATA%/PaperDesk`。
