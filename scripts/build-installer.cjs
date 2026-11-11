'use strict';
// electron-builder's verified NSIS toolset, used without running a Windows
// uninstaller binary during cross-compilation. No Wine dependency.
const {createRequire}=require('node:module');
const builderRequire=createRequire(require.resolve('electron-builder'));
const {getMakeNsisPath}=builderRequire('app-builder-lib/out/toolsets/windows');
const {spawn}=require('node:child_process');const path=require('node:path');const fs=require('node:fs');
(async()=>{fs.mkdirSync(path.join(__dirname,'../release'),{recursive:true});const compiler=await getMakeNsisPath();const child=spawn(compiler.path,[process.platform==='win32'?'/V2':'-V2',path.join(__dirname,'setup.nsi')],{env:{...process.env,...compiler.env},stdio:'inherit'});child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('exit',code=>process.exitCode=code||0);})().catch(e=>{console.error(e);process.exitCode=1;});
