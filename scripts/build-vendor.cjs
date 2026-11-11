'use strict';
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..'),target=path.join(root,'assets/vendor');fs.mkdirSync(target,{recursive:true});
for(const [name,files]of Object.entries({marked:['lib/marked.umd.js','LICENSE'],dompurify:['dist/purify.min.js','LICENSE'],katex:['dist/katex.min.js','dist/katex.min.css','dist/fonts','LICENSE']})){
 let directory=path.dirname(require.resolve(name));while(!fs.existsSync(path.join(directory,'package.json')))directory=path.dirname(directory);
 const destination=path.join(target,name);fs.mkdirSync(destination,{recursive:true});
 for(const file of files)fs.cpSync(path.join(directory,file),path.join(destination,path.basename(file)),{recursive:true});
}
console.log('Bundled local Markdown, sanitizer and formula renderer with fonts and licenses.');
