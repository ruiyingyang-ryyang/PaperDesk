'use strict';
const fs=require('node:fs'),path=require('node:path');
const APP_ID='PaperDesk.Research';
function iconPath(app,resourcesPath,sourceRoot){const physical=path.join(resourcesPath,'PaperDesk.ico');return app.isPackaged&&fs.existsSync(physical)?physical:path.join(sourceRoot,'assets/icon.ico');}
function configureTaskbar(win,{app,icon,exe=process.execPath,testProfile=false}){win.setIcon(icon);if(process.platform==='win32')win.setAppDetails({appId:APP_ID+(testProfile?'.Test':''),appIconPath:icon,appIconIndex:0,relaunchCommand:'"'+exe+'"',relaunchDisplayName:'PaperDesk'});}
function repairShortcuts({app,shell,icon,exe=process.execPath,testProfile=false}){
 if(process.platform!=='win32'||!app.isPackaged||testProfile)return {updated:0,failed:0};
 const start=path.join(app.getPath('appData'),'Microsoft/Windows/Start Menu/Programs/PaperDesk.lnk'),desktop=path.join(app.getPath('desktop'),'PaperDesk.lnk'),pinned=path.join(app.getPath('appData'),'Microsoft/Internet Explorer/Quick Launch/User Pinned/TaskBar');
 const links=[start,desktop];if(fs.existsSync(pinned))for(const name of fs.readdirSync(pinned))if(/\.lnk$/i.test(name)){const file=path.join(pinned,name);try{const old=shell.readShortcutLink(file);if(path.basename(old.target).toLowerCase()==='paperdesk.exe'||old.appUserModelId===APP_ID)links.push(file);}catch{}}
 let updated=0,failed=0;
 for(const file of links){try{fs.mkdirSync(path.dirname(file),{recursive:true});const old=fs.existsSync(file)?shell.readShortcutLink(file):null;const details={target:exe,cwd:path.dirname(exe),args:old?.args||'',description:'PaperDesk',appUserModelId:APP_ID,icon,iconIndex:0};if(!shell.writeShortcutLink(file,old?'update':'create',details))throw Error('SHORTCUT_WRITE_FAILED');updated++;}catch{failed++;}}
 return {updated,failed};
}
module.exports={APP_ID,iconPath,configureTaskbar,repairShortcuts};
