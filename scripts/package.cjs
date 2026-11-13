'use strict';
// The runtime has no third-party dependencies. Stage only application files so
// development tools and personal test profiles can never enter the installer.
const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const {packager}=await import('@electron/packager');
 const root=path.resolve(__dirname,'..'),tmp=path.join(root,'tmp');fs.mkdirSync(tmp,{recursive:true});
 const stage=fs.mkdtempSync(path.join(tmp,'package-'));
 for(const name of ['src','assets','LICENSE','README.md','THIRD_PARTY_NOTICES.md'])fs.cpSync(path.join(root,name),path.join(stage,name),{recursive:true});
 require('./distribution-privacy.cjs').assertShareable(stage);
 const metadata=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 delete metadata.devDependencies;delete metadata.scripts;fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify(metadata,null,2));
 const outputs=await packager({dir:stage,name:'PaperDesk',platform:process.argv[2]||'win32',arch:'x64',electronVersion:'45.2.3',...(process.env.PAPERDESK_ELECTRON_ZIP_DIR?{electronZipDir:process.env.PAPERDESK_ELECTRON_ZIP_DIR}:{}),out:path.resolve(root,process.env.PAPERDESK_PACKAGE_OUT||'dist'),overwrite:true,prune:false,asar:true,icon:path.join(root,'assets/icon.ico'),appVersion:metadata.version,appCopyright:'PaperDesk contributors'});
 for(const output of outputs){fs.copyFileSync(path.join(root,'assets/icon.ico'),path.join(output,'resources','PaperDesk.ico'));if((process.argv[2]||'win32')==='win32')await require('./windows-metadata.cjs').clearVersionLabels(path.join(output,'PaperDesk.exe'));}
 console.log(outputs.join('\n'));
})().catch(e=>{console.error(e);process.exitCode=1;});
