# 安全报告

请不要在公开 Issue 中粘贴 API 密钥、个人论文库或包含敏感信息的日志。

若仓库启用了 GitHub 的私密漏洞报告，请通过 Security 页面中的 Report a vulnerability 提交复现步骤、影响范围和建议修复；未启用时，请先提交不含敏感细节的联系请求，等待维护者提供私密渠道。仓库维护者应在发布时启用私密漏洞报告。

设置中的 API 密钥通过当前 Windows 用户的安全存储保护。应用调用用户选择的服务时，会向对应服务发送必要的论文、提问或写作文本。JSON 备份不包含密钥存储。分享源码和安装包前可运行 `node scripts/distribution-privacy.cjs src assets scripts test docs` 检查交付目录。
