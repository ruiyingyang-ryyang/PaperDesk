'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {marked}=require('../assets/vendor/marked/marked.umd.js');
const root=path.resolve(__dirname,'..');
function copy(from,to){fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(from,to,{recursive:true});}
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function html(markdown){return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PaperDesk 使用指南</title><style>html{background:#f9fafb}*{box-sizing:border-box}body{max-width:850px;margin:36px auto;padding:46px 52px;background:#fff;color:#0f1115;font-family:Arial,"Microsoft YaHei",sans-serif;font-size:16px;line-height:1.85;border-radius:12px;box-shadow:0 2px 12px #0f111507}h1,h2,h3{color:#0f1115;font-weight:600;line-height:1.5}h1{font-size:29px;margin:0 0 16px}h2{font-size:22px;margin:38px 0 14px}h3{font-size:18px;margin:25px 0 10px}p{margin:12px 0}li{margin:8px 0}a{color:#4176e6;text-underline-offset:3px}code{font:14px Arial,sans-serif;background:#f1f3f5;padding:3px 6px;border-radius:5px;overflow-wrap:anywhere}strong{font-weight:600}h2,h3{break-after:avoid}p,li{orphans:3;widows:3}@media(max-width:700px){body{margin:0;padding:26px 22px;border-radius:0;font-size:15px}h1{font-size:25px}}@media print{@page{size:A4;margin:20mm}html{background:white}body{padding:0;margin:0;max-width:none;box-shadow:none;font-size:10.5pt}h1{font-size:20pt}h2{font-size:15pt}h3{font-size:12pt}}</style></head><body><main>`+marked.parse(markdown)+'</main></body></html>';}
function exportDelivery(destination){
 if(!destination)throw Error('Provide the delivery directory as the first argument');
 const out=path.resolve(destination);if(out===root||out.startsWith(root+path.sep))throw Error('Delivery directory must be outside the working source tree');fs.mkdirSync(out,{recursive:true});
 const privacy=require('./distribution-privacy.cjs');for(const name of ['src','assets','scripts','test','docs','dist/PaperDesk-win32-x64'])privacy.assertShareable(path.join(root,name));
 copy(path.join(root,'release/PaperDesk-Windows-x64-Setup.exe'),path.join(out,'PaperDesk-Windows-x64-Setup.exe'));
 copy(path.join(root,'dist/PaperDesk-win32-x64'),path.join(out,'便携版'));
 const source=path.join(out,'source');if(path.resolve(source)!==root){for(const name of ['src','assets','scripts','test','docs','.github','package.json','package-lock.json','pnpm-lock.yaml','pnpm-workspace.yaml','electron-builder.json','README.md','LICENSE','CHANGELOG.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','SECURITY.md','THIRD_PARTY_NOTICES.md','.gitignore','.gitattributes'])copy(path.join(root,name),path.join(source,name));}
 const doc=path.join(out,'文档');fs.mkdirSync(doc,{recursive:true});const promotion=fs.readFileSync(path.join(root,'docs/使用指南.md'),'utf8');fs.writeFileSync(path.join(doc,'使用指南.md'),promotion);fs.writeFileSync(path.join(doc,'使用指南.html'),html(promotion));fs.writeFileSync(path.join(doc,'完整使用说明.md'),fs.readFileSync(path.join(root,'README.md'),'utf8').replace(/\]\((?!https?:|#)([^)]+)\)/g,'](https://github.com/ruiyingyang-ryyang/PaperDesk/blob/main/$1)'));
 fs.writeFileSync(path.join(out,'使用说明.md'),'# PaperDesk\n\n双击 PaperDesk-Windows-x64-Portable.exe 可免安装启动；或运行 PaperDesk-Windows-x64-Setup.exe 安装。\n\n完整说明：https://github.com/ruiyingyang-ryyang/PaperDesk\n');
 copy(path.join(root,'CHANGELOG.md'),path.join(out,'更新说明.md'));
 copy(path.join(root,'THIRD_PARTY_NOTICES.md'),path.join(out,'THIRD_PARTY_NOTICES.md'));
 const portable=path.join(root,'release/PaperDesk-Windows-x64-Portable.exe');if(fs.existsSync(portable))copy(portable,path.join(out,'PaperDesk-Windows-x64-Portable.exe'));
 for(const relative of ['预览/赞助页面.png','source/assets/donation.png']){const obsolete=path.resolve(out,relative);if(!obsolete.startsWith(out+path.sep))throw Error('Invalid obsolete path');if(fs.existsSync(obsolete))fs.unlinkSync(obsolete);}
 privacy.assertShareable(out);
 const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(e.isFile()&&e.name!=='SHA256SUMS.txt')files.push(file);}}walk(out);files.sort();fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),files.map(file=>hash(file)+'  '+path.relative(out,file).split(path.sep).join('/')).join('\n')+'\n');
 console.log('Exported '+files.length+' files to '+out);
}
if(require.main===module)exportDelivery(process.argv[2]);module.exports={exportDelivery,html};
