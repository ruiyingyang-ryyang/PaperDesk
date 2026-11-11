'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const entries=['src','assets','scripts','test','docs','.github','package.json','package-lock.json','pnpm-lock.yaml','pnpm-workspace.yaml','electron-builder.json','README.md','LICENSE','CHANGELOG.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','SECURITY.md','THIRD_PARTY_NOTICES.md','.gitignore','.gitattributes'];
const destination=process.argv[2];if(!destination)throw Error('Provide a new destination folder.');
const out=path.resolve(destination);if(out===root||out.startsWith(root+path.sep)||fs.existsSync(out))throw Error('Choose a new folder outside the source tree.');
const privacy=require('./distribution-privacy.cjs');
for(const entry of entries){const from=path.join(root,entry);if(fs.statSync(from).isDirectory())privacy.assertShareable(from);}
fs.mkdirSync(out,{recursive:true});for(const entry of entries)fs.cpSync(path.join(root,entry),path.join(out,entry),{recursive:true});
privacy.assertShareable(out);
const files=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile()){if(fs.statSync(file).size>=100*1024*1024)throw Error('File exceeds source upload limit: '+path.relative(out,file));files.push(file);}}}walk(out);
files.sort();fs.writeFileSync(path.join(out,'SOURCE_MANIFEST.sha256'),files.map(file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')+'  '+path.relative(out,file).split(path.sep).join('/')).join('\n')+'\n');
console.log('Prepared '+files.length+' source files: '+out);
