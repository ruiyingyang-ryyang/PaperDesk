<div align="center">
  <img src="assets/icon.png" width="72" alt="PaperDesk 图标">
  <h1>PaperDesk</h1>
  <p>面向科研阅读的 Windows 工作台：发现论文、整理文献、提问与写作。</p>
  <p><a href="https://github.com/ruiyingyang-ryyang/PaperDesk/releases/latest">下载软件</a> · <a href="docs/使用指南.md">使用指南</a> · <a href="https://github.com/ruiyingyang-ryyang/PaperDesk/issues">问题反馈</a></p>
</div>

## 下载后直接运行

**普通用户只需一台 Windows 11 x64 电脑和下方一个 EXE 文件。** 运行环境、字体和公式渲染资源已随软件提供，无需另装 Node.js、Python、Git 或 Electron。

| 使用方式 | 下载文件 | 启动方法 |
| --- | --- | --- |
| 免安装，双击打开 | [PaperDesk-Windows-x64-Portable.exe](https://github.com/ruiyingyang-ryyang/PaperDesk/releases/download/v1.0.0/PaperDesk-Windows-x64-Portable.exe) | 双击 EXE；首次运行自动解压运行文件，之后直接启动 |
| 安装后使用桌面快捷方式 | [PaperDesk-Windows-x64-Setup.exe](https://github.com/ruiyingyang-ryyang/PaperDesk/releases/download/v1.0.0/PaperDesk-Windows-x64-Setup.exe) | 双击安装包，静默安装完成后自动启动 |

[全部版本](https://github.com/ruiyingyang-ryyang/PaperDesk/releases) · [V1.0.0 文件校验值](https://github.com/ruiyingyang-ryyang/PaperDesk/releases/download/v1.0.0/SHA256SUMS.txt)

首次打开可以浏览界面。需要联网的功能，请准备自己的 API 密钥，再到应用的“检索设置”保存：

| 使用场景 | 需要准备 |
| --- | --- |
| AI 问答、摘要翻译、论文解释、辅助写作、AI 归纳 | [DeepSeek](https://platform.deepseek.com/) 或 [OpenAI](https://platform.openai.com/) 的 API 密钥，选择一个接口即可 |
| Google Scholar 论文检索、每周推送 | [SerpApi](https://serpapi.com/) 的 API 密钥 |
| 阅读已收录论文、收藏标签、历史问题搜索、导出已有资料 | 使用本机已保存的数据；开启 AI 归纳时仍需要对应 API |

访问 GitHub 或部分服务可能需要科学上网。API 额度与费用由相应服务商管理，下载 PaperDesk 本身不提供 API 额度。

> GitHub 的 **Code → Download ZIP** 下载的是源码。希望直接使用软件，请选择上面的 EXE 文件。

## 功能概览

| 功能 | 说明 |
| --- | --- |
| 论文发现 | 按关键词组、期刊、作者、机构与发表年月筛选论文，读取 Crossref、OpenAlex 等来源的元数据 |
| 每周推送 | 自定义时间，收集前 7 个完整自然日发表且未推送过的论文，按周归纳和导出 Markdown |
| 研究问答 | 使用 GPT 或 DeepSeek 连续提问，按对话名称及提问正文搜索并定位历史问题 |
| 辅助写作 | 按期刊与写作类型润色、翻译或润色并翻译，左右对照原文与处理结果 |
| 文献整理 | 星标收藏、自定义标签、通讯作者筛选、摘要翻译与通俗解释 |
| 阅读界面 | 中英文、日间与夜间主题、字号调整、可折叠工具栏，支持 Markdown 和数学公式 |

## 第一次使用

1. 启动软件，在“检索设置”保存所需 API 密钥并测试连接。
2. 填写关键词与关注期刊，保存后点击“立即检索”。
3. 点击论文阅读摘要和来源信息，用星标与标签整理阅读清单。
4. 在“快速检索”中提问，或进入“辅助写作”处理文段。
5. 需要持续追踪时，在“推送设置”保存独立条件、选择时间并启用每周推送。

详细操作和功能边界见 [使用指南](docs/使用指南.md)。

## 数据与隐私

- 论文、收藏、设置与对话默认保存在 `%APPDATA%\PaperDesk`；API 密钥由当前 Windows 用户的安全存储加密保护。
- 使用 AI 时，提问、相关摘要或写作文本会发送给所选服务商；检索时会向相应服务发送检索条件。
- JSON 备份排除密钥存储。分享备份前，请检查自己在正文或标签中填写的内容。
- 免安装 EXE 的运行文件缓存在 `%LOCALAPPDATA%\PaperDeskPortable\1.0.0`，研究数据仍使用上述应用数据目录。
- 更新或卸载默认保留研究库。“重新开始”会清空论文和对话等本机资料，请先导出重要内容。

## 常见问题

**安装包为什么没有安装向导？**  
安装包采用静默安装，完成后会启动应用，并创建桌面和开始菜单快捷方式。更新前请退出托盘里的旧版本。

**免安装版和安装版有什么区别？**  
免安装版直接运行，首次启动自动准备本机缓存；安装版提供常规快捷方式和卸载入口。两者使用相同的应用数据目录。

**“快速检索”会实时搜索互联网吗？**  
该板块是基于所选模型的问答。实时论文发现请使用论文检索；历史问题搜索在本机进行。

**定时推送需要一直开机吗？**  
需要用户已登录、电脑开机并联网。关机时无法准时运行，恢复后会检查错过的任务。

## 从源码运行与构建

本节面向开发者。请准备 **Node.js 22.12+（含 npm）** 和 Git；Windows 打包及桌面检查使用 Windows 11 x64。

```powershell
git clone https://github.com/ruiyingyang-ryyang/PaperDesk.git
cd PaperDesk
npm ci
npm start
```

```powershell
npm test
npm run test:desktop
npm run build:win
npm run build:portable
npm run test:release
```

| 路径 | 内容 |
| --- | --- |
| `src/` | Electron 主进程、界面和业务逻辑 |
| `assets/` | 图标、字体、前端渲染资源和第三方许可 |
| `scripts/` | 构建、打包、桌面检查与交付工具 |
| `test/` | 自动测试 |
| `docs/` | 使用与发布指南 |
| `dist/`、`release/` | 本机构建产物，不提交到源码仓库 |

开发与验证方式见 [贡献指南](CONTRIBUTING.md)。

## 反馈与参与

欢迎提交可复现的问题、文档改进与代码贡献。

- [提交问题或建议](https://github.com/ruiyingyang-ryyang/PaperDesk/issues)
- [作者 GitHub 主页](https://github.com/ruiyingyang-ryyang)
- [贡献指南](CONTRIBUTING.md) · [社区行为准则](CODE_OF_CONDUCT.md) · [安全报告](SECURITY.md)

应用顶部的“问题反馈”会先展示作者主页链接和网络提示，确认后才打开浏览器。

## 许可证与致谢

PaperDesk 原创代码采用 [MIT 许可证](LICENSE)。第三方组件与字体保留各自许可证，详见 [第三方声明](THIRD_PARTY_NOTICES.md)。

元数据服务包括 Crossref 与 OpenAlex，论文检索使用 SerpApi。前端使用 Marked、DOMPurify 和 KaTeX；字体包含 Libre Bodoni 与 STIX Two Text，主题配色参考 DeepSeek Harness。
