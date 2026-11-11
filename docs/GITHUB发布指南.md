# 维护与发布指南

[项目仓库](https://github.com/ruiyingyang-ryyang/PaperDesk) · [发布页](https://github.com/ruiyingyang-ryyang/PaperDesk/releases) · [返回主页](../README.md)

## 源码与发行文件

源码保存在 `main` 分支。普通用户下载 Releases 中的 EXE，GitHub 自动生成的 Source code ZIP 是开发源码。

- 安装版：`PaperDesk-Windows-x64-Setup.exe`。
- 免安装启动版：`PaperDesk-Windows-x64-Portable.exe`，首次运行自动解压至本机缓存。
- 校验文件：`SHA256SUMS.txt`，记录上述发行文件的 SHA-256。

EXE 作为 Release 附件上传，不放入 Git 源码提交。第三方声明与许可证必须随源码和打包资源保留。

## 本地验证

在 Windows 11 x64 中准备 Node.js 22.12+、npm 和 Git，执行：

```powershell
npm ci
npm test
npm run test:desktop
npm run build:win
npm run build:portable
npm run test:release
```

构建产物在 `dist/` 与 `release/`。桌面检查使用独立测试资料库和模拟 API，不使用真实研究库或付费密钥。

## 发布步骤

1. 更新项目版本和 `CHANGELOG.md`，维护 README 下载链接。
2. 更新 `SOURCE_MANIFEST.sha256` 中的源码校验值，确认自动测试和隐私检查通过。
3. 提交并推送源码，在对应提交创建版本标签。
4. 在 GitHub Releases 发布该标签，上传安装版、免安装版和发行文件校验值。
5. 检查下载链接、文件大小及 SHA-256，再确认 README 的启动步骤可复现。

现有版本标签发布后应保持稳定；后续软件变更使用新的版本和标签。

## GitHub 自动检查

`Checks` 工作流检查依赖安装、自动测试和源码隐私规则。`Windows build` 可由维护者手动运行，构建两种 Windows EXE 并保存下载产物。

自动检查配置在 `.github/workflows/`。不提交个人应用资料、浏览器缓存、API 密钥、依赖目录或构建缓存。安全问题按 [安全报告](../SECURITY.md) 处理。
