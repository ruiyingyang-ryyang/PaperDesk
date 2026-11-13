# PDF.js 6.5.438

Source: https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.5.438.tgz

The upstream npm archive was verified with its published SHA-512 integrity. This bundle uses `legacy/build/pdf.mjs` and `legacy/build/pdf.worker.mjs` for browser compatibility, plus the upstream viewer stylesheet, CMaps, standard fonts and WASM image decoders. The complete viewer stylesheet is retained for reference but is not loaded by the application. Only scoped text-layer rules in `src/pdf-text-layer.css` are loaded, preventing upstream sidebar and control styles from affecting PaperDesk. No network resources are loaded by the viewer.

License: Apache-2.0; see LICENSE and component license files.
