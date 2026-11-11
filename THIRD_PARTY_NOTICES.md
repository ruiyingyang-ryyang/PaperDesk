# 第三方组件与资源

PaperDesk 的原创代码采用根目录 MIT 许可证。以下资源保留各自许可证和版权声明：

| 资源 | 用途 | 随附许可证 |
| --- | --- | --- |
| Marked | Markdown 渲染 | `assets/vendor/marked/LICENSE` |
| DOMPurify | HTML 净化 | `assets/vendor/dompurify/LICENSE` |
| KaTeX 与随附字体 | 数学公式 | `assets/vendor/katex/LICENSE` |
| Libre Bodoni | 品牌字体 | `assets/fonts/LibreBodoni-OFL.txt` |
| STIX Two Text | 字体 | `assets/fonts/OFL.txt` |
| DeepSeek Harness | 主题配色与交互视觉参考 | `assets/licenses/DeepSeek-Harness-MIT.txt` |

主题来源：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，采用 [MIT 许可证](https://github.com/deepseek-ai/deepseek-harness/blob/master/LICENSE)；PaperDesk 的映射和调整位于 `src/harness-palette.css`。字体来自 Google Fonts 对应字体项目。

开发及打包依赖见 `package.json` 与 `package-lock.json`，依赖安装后各自携带许可证。Electron 发行文件的许可证随生成的应用目录提供。项目许可证不改变用户导入论文、文本和其他材料的权利归属。
