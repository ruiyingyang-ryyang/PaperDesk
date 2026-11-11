'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {createRequire}=require('node:module');const {pathToFileURL}=require('node:url');
(async()=>{
 const req=createRequire(require.resolve('@electron/packager')),asar=await import(pathToFileURL(req.resolve('@electron/asar')).href);const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
 const archive=path.join(root,'dist/PaperDesk-win32-x64/resources/app.asar');const entries=asar.listPackage(archive).map(x=>x.replaceAll('\\','/'));assert(!entries.some(x=>/(^|\/)(node_modules|tmp|test|screenshots|scripts)(\/|$)/.test(x)));
 const walk=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 for(const f of [...walk('src'),...walk('assets'),'README.md','LICENSE','THIRD_PARTY_NOTICES.md'])assert.deepEqual(asar.extractFile(archive,path.normalize(f)),fs.readFileSync(path.join(root,f)),f+' differs from source');
 const metadata=JSON.parse(asar.extractFile(archive,'package.json'));assert.equal(metadata.version,version);assert(!metadata.devDependencies);
 assert.deepEqual(fs.readFileSync(path.join(root,'dist/PaperDesk-win32-x64/resources/PaperDesk.ico')),fs.readFileSync(path.join(root,'assets/icon.ico')),'physical taskbar icon differs from source');
 const pe=fs.readFileSync(path.join(root,'dist/PaperDesk-win32-x64/PaperDesk.exe'));assert.equal(pe.readUInt16LE(pe.readUInt32LE(0x3c)+4),0x8664);
 const installer=path.join(root,'release/PaperDesk-Windows-x64-Setup.exe');assert(fs.statSync(installer).size>100000000);
 const setup=fs.readFileSync(path.join(root,'scripts/setup.nsi'),'utf8');assert(setup.includes('SilentInstall silent'));assert(setup.includes('ShowInstDetails nevershow'));assert(setup.includes('AutoCloseWindow true'));assert.equal((setup.match(/CreateShortCut[^\r\n]+PaperDesk\.ico/g)||[]).length,2);
 console.log('PASS packaged application and all local renderer/font/icon assets match source');console.log('PASS Windows x64 release, silent NSIS installer and no developer/test data');
})().catch(e=>{console.error(e);process.exitCode=1;});

