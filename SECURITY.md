# 安全报告

请不要在公开 Issue 中粘贴 API 密钥、个人论文库或包含敏感信息的日志。

通过 [GitHub 私密漏洞报告](https://github.com/ruiyingyang-ryyang/PaperDesk/security/advisories/new) 提交复现步骤、影响范围和建议修复。项目已启用私密漏洞报告，请不要通过公开 Issue 披露可利用的漏洞细节。

设置中的 API 密钥通过当前 Windows 用户的安全存储保护。应用调用用户选择的服务时，会向对应服务发送必要的论文、提问或写作文本。JSON 备份不包含密钥存储。分享源码和安装包前可运行 `node scripts/distribution-privacy.cjs src assets scripts test docs` 检查交付目录。
