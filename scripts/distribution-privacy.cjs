'use strict';
const fs=require('node:fs'),path=require('node:path');
const privateDirectory=/^(?:user[ _-]?data|appdata|profiles?|logs?|crashpad|local storage|session storage|network|code cache|gpu ?cache)$/i;
const privateFile=/^(?:library\.json(?:\..*)?|\.env(?:\..*)?|cookies(?:-journal)?|login data(?:-journal)?|local state|preferences|(?:secrets?|credentials?)(?:\.[^/]*)?)$|\.(?:log|bak|dmp|key|pem)$/i;
function savedSecretMarkers(){
 const markers=[];if(!process.env.APPDATA)return markers;
 for(const name of ['library.json','library.json.bak']){const file=path.join(process.env.APPDATA,'PaperDesk',name);if(!fs.existsSync(file))continue;try{const data=JSON.parse(fs.readFileSync(file,'utf8'));for(const value of [data.secrets?.serpapi,data.secrets?.deepseek,data.secrets?.gpt,data.settings?.serpapiKey,data.settings?.deepseekKey,data.settings?.gptKey])if(typeof value==='string'&&value.length>=16)markers.push(value);}catch{throw Error('Cannot inspect saved credential markers; sharing check stopped.');}}
 return [...new Set(markers)];
}
function assertShareable(directory,{knownSecrets=savedSecretMarkers()}={}){
 const root=path.resolve(directory);let files=0;
 function fail(file,reason){throw Error('Sharing check stopped: '+reason+' ('+path.relative(root,file)+')');}
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isSymbolicLink())fail(file,'linked content');if(entry.isDirectory()){if(privateDirectory.test(entry.name))fail(file,'personal application data');walk(file);}else if(entry.isFile()){
  if(privateFile.test(entry.name))fail(file,'private data or credential file');
  const buffer=fs.readFileSync(file);for(const value of knownSecrets)if(buffer.includes(Buffer.from(value)))fail(file,'saved credential content');
  // Only source/text formats need pattern checks; binary archives are verified
  // against the independently checked staging tree by verify-release.cjs.
  if(/\.(?:c?js|mjs|json|html|css|md|txt|ya?ml|env|ini|config)$/i.test(entry.name)){
   const value=buffer.toString('utf8');if(/\bsk-[A-Za-z0-9_-]{20,}\b/.test(value)||/["']?(?:api[_-]?key|serpapiKey|deepseekKey|gptKey|authorization|serpapi|deepseek)["']?\s*[:=]\s*["'](?:Bearer\s+)?[A-Za-z0-9_-]{24,}["']/i.test(value))fail(file,'embedded API credential');
  }files++;
 }}}
 walk(root);return files;
}
if(require.main===module){let count=0;for(const directory of process.argv.slice(2))count+=assertShareable(directory);console.log('PASS sharing privacy: '+count+' files checked; no saved credentials, private profiles or logs.');}
module.exports={assertShareable,savedSecretMarkers};
