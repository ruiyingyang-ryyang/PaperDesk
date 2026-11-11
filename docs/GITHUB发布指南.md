# 将 PaperDesk V1.0.0 发布到 GitHub

此文件夹是仓库根目录，可以独立安装依赖、运行、测试和构建。项目已公开发布于 https://github.com/ruiyingyang-ryyang/PaperDesk 。以下步骤用于维护仓库，或发布你自己的分支版本。

## 上传源码

1. 登录自己的 GitHub 账户，新建名为 PaperDesk 的空仓库，选择 Public；不要勾选自动创建 README、许可证或 .gitignore，因为本目录已经提供。
2. 用 GitHub Desktop 选择本文件夹作为本地仓库，提交全部文件，再发布到自己的 GitHub 仓库。
3. 也可使用 Git：先在本目录执行 `git init`、`git add .`、`git commit -m "Release PaperDesk V1.0.0"` 和 `git branch -M main`。将新建仓库页面给出的真实地址添加为 origin，然后执行 `git push -u origin main`。
4. GitHub Actions 会执行依赖安装和自动测试。维护者可手动运行 Windows build 流程，下载安装包并检查。

## 发布安装包

在 Windows 11 x64 电脑中执行：

```powershell
npm ci
npm test
npm run build:win
npm run test:release
```

确认后在 GitHub Releases 新建 `v1.0.0` 标签和 `PaperDesk V1.0.0` 发布，附上 `release/PaperDesk-Windows-x64-Setup.exe`。便携版需压缩整个 `dist/PaperDesk-win32-x64/` 文件夹。安装器目前没有代码签名。

安装文件不放入源码提交。`node_modules`、构建缓存、临时资料库、个人研究资料和 API 密钥均不应上传。`.gitignore` 已排除常见本机文件；`THIRD_PARTY_NOTICES.md` 和随附第三方许可证须一起保留。

可在仓库设置中启用私密漏洞报告。README 中不预设仓库所有者、远程地址或维护者邮箱；发布后按实际情况填写即可。
