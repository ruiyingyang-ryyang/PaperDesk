'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
(async()=>{
 const application=path.join(root,'dist/PaperDesk-win32-x64');
 if(!fs.existsSync(path.join(application,'PaperDesk.exe')))throw Error('Run npm run package:win before building the portable EXE.');
 require('./distribution-privacy.cjs').assertShareable(application);
 const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid portable version.');
 fs.mkdirSync(path.join(root,'release'),{recursive:true});
 const req=createRequire(require.resolve('electron-builder'));
 const compiler=await req('app-builder-lib/out/toolsets/windows').getMakeNsisPath();
 const prefix=process.platform==='win32'?'/':'-';
 const child=spawn(compiler.path,[prefix+'V2',prefix+'DAPP_VERSION='+version,path.join(__dirname,'portable.nsi')],{env:{...process.env,...compiler.env},stdio:'inherit',windowsHide:true});
 child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('exit',code=>process.exitCode=code||0);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
