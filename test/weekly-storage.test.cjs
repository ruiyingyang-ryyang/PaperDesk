'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../src/core.cjs'),F=require('../src/features.cjs'),P=require('../src/providers.cjs'),W=require('../src/windows.cjs'),Reports=require('../src/weekly-export.cjs');
const temporary=path.resolve(__dirname,'../tmp');fs.mkdirSync(temporary,{recursive:true});
const temp=()=>fs.mkdtempSync(path.join(temporary,'weekly-store-'));
const remove=dir=>{assert(path.resolve(dir).startsWith(temporary+path.sep));fs.rmSync(dir,{recursive:true,force:true});};
test('abstract heading is removed without removing scientific words or abstract content',()=>{
 for(const value of ['Abstract Accurate spectral measurement','Abstract: Accurate spectral measurement','<h2>Abstract</h2><p>Accurate spectral measurement</p>','摘要：Accurate spectral measurement'])assert.equal(C.cleanAbstract(value),'Accurate spectral measurement');
 assert.equal(C.cleanAbstract('Abstractness is studied.'),'Abstractness is studied.');assert.equal(C.cleanAbstract('An abstract representation is used.'),'An abstract representation is used.');assert.equal(C.normalizePaper({title:'A',abstract:'Abstract Accurate spectral measurement'}).abstract,'Accurate spectral measurement');
});
test('weekly dates use exactly the seven complete calendar days before the push date',()=>{
 const window=F.weeklyWindow(new Date(2026,0,2,8));assert.deepEqual(window,{start:'2025-12-26',end:'2026-01-02'});
 assert(F.publicationInWindow({publicationDate:'2025-12-26'},window));assert(F.publicationInWindow({publicationDate:'2026-01-01'},window));
 for(const day of ['2025-12-25','2026-01-02','','2026-02-30'])assert(!F.publicationInWindow({publicationDate:day},window));
});
test('partial publication dates are never invented for weekly inclusion',()=>{assert.equal(F.fromParts([2026]),'');assert.equal(F.fromParts([2026,11]),'');assert.equal(F.fromParts([2026,11,6]),'2026-11-06');assert.equal(F.fromParts([2026,2,30]),'');});
test('author-only settings are searchable and manual year limits never leak into weekly settings',()=>{
 const s=C.defaults().settings;s.authorName='Alice Chen';s.yearFrom=2020;s.yearTo=2026;s.weekly.authorName='Ming Li';
 assert(C.queryPlan(C.searchSettings(s)).some(p=>p.q.includes('author:"Alice Chen"')));assert.equal(C.searchSettings(s,true).yearFrom,null);assert.equal(C.searchSettings(s,true).authorName,'Ming Li');
 assert.throws(()=>C.validateSettings({...s,yearFrom:2026,yearTo:2020}),/INVALID_YEAR_RANGE/);
});
test('manual year filters reject unknown and out-of-range years only when a limit is set',()=>{
 assert(F.inYearRange({year:'2024'},{yearFrom:2020,yearTo:2026}));assert(!F.inYearRange({year:'2019'},{yearFrom:2020}));assert(!F.inYearRange({year:''},{yearTo:2026}));assert(F.inYearRange({year:''},{}));
});
test('a previously delivered paper stays deduplicated after DOI enrichment and record refresh',()=>{
 const a=C.normalizePaper({title:'A paper',journal:'Nature',year:'2026'}),ledger=[{...a,at:1}];const b=C.normalizePaper({...a,doi:'10.1000/new'});assert(F.alreadyDelivered(b,ledger));assert(!F.alreadyDelivered(C.normalizePaper({title:'Another',doi:'10.1000/other'}),ledger));
 const both=[{...a,doi:'10.1000/a'}];assert(!F.alreadyDelivered({...a,doi:'10.1000/b'},both));
});
test('reset clears local records/settings and recovery snapshots while preserving encrypted API credentials',()=>{
 const dir=temp();try{const store=new C.Store(dir);store.data.secrets={serpapi:'encrypted-serp',deepseek:'encrypted-ds'};store.data.settings.deepseekModel='deepseek-v4-pro';store.data.settings.appearance={theme:'dark',fontSize:19};store.data.papers=[C.normalizePaper({title:'Remove me'})];store.data.chats=[{id:'chat',title:'Old question',messages:[]}];store.data.deliveryLedger=[{title:'Old delivery'}];store.save();fs.writeFileSync(path.join(dir,'library.json.corrupt-123'),'Old records');store.resetPreservingAPI();
  const restored=new C.Store(dir);assert.deepEqual(restored.data.secrets,{serpapi:'encrypted-serp',deepseek:'encrypted-ds'});assert.equal(restored.data.settings.deepseekModel,'deepseek-v4-pro');assert.equal(restored.data.papers.length,0);assert.equal(restored.data.chats.length,0);assert.equal(restored.data.runs.length,0);assert.equal(restored.data.deliveryLedger.length,0);assert.equal(restored.data.settings.appearance.fontSize,13);assert.equal(restored.data.settings.scheduleEnabled,false);assert(!fs.readFileSync(path.join(dir,'library.json.bak'),'utf8').includes('Remove me'));assert(!fs.existsSync(path.join(dir,'library.json.corrupt-123')));
 }finally{remove(dir);}
});
test('legacy abstract headings and weekly associations migrate without losing API keys',()=>{
 const dir=temp();try{const store=new C.Store(dir),p=C.normalizePaper({title:'A',abstract:'Original'});p.abstract='Abstract Accurate';store.data.papers=[p];store.data.runs=[{id:'week',scheduled:true,startedAt:new Date(2026,10,6,8).getTime(),paperIds:[p.id]}];store.data.secrets.deepseek='cipher';store.save();const loaded=new C.Store(dir);assert.equal(loaded.data.papers[0].abstract,'Accurate');assert.equal(loaded.data.deliveryLedger.length,1);assert.equal(loaded.data.papers[0].weeklyDeliveries[0].week,'2026-11-02');assert.equal(loaded.data.secrets.deepseek,'cipher');}finally{remove(dir);}
});
test('weekly export honors selected IDs and delivery-date range',async()=>{
 const dir=temp();try{const papers=[['A','2026-11-06'],['B','2026-10-30']].map(([title,date])=>C.normalizePaper({title,abstract:'Abstract Accurate result',year:'2026',publicationDate:date,weeklyDeliveries:[{at:new Date(date+'T08:00:00').getTime(),week:F.weekKey(new Date(date+'T08:00:00')),runId:title}]}));
  const result=await Reports.exportWeekly({papers,runs:[],selection:{ids:papers.map(p=>p.id)},directory:dir});assert.equal(result.files.length,2);assert(fs.existsSync(path.join(result.directory,'index.md')));assert(fs.readFileSync(path.join(result.directory,result.files[0]),'utf8').includes('Accurate result'));
  const chosen=F.selectWeekly(papers,[],{ids:papers.map(p=>p.id),from:'2026-11-01',to:'2026-11-08'});assert.equal(chosen.length,1);assert.equal(chosen[0].title,'A');
 }finally{remove(dir);}
});
test('AI report chunks keep original citation numbers and use only selected source material',()=>{const messages=F.summaryMessages([C.normalizePaper({title:'Selected',abstract:'Abstract Accurate'})],12);const input=JSON.parse(messages[1].content);assert.equal(input[0].number,13);assert.equal(input[0].abstract,'Accurate');assert(messages[0].content.includes('不补造'));});
test('a failed AI summary never leaves a partially exported batch',async()=>{
 const dir=temp();try{const papers=[C.normalizePaper({title:'A',weeklyDeliveries:[{at:new Date('2026-11-06T08:00:00').getTime(),week:'2026-11-02',runId:'a'}]})];await assert.rejects(Reports.exportWeekly({papers,runs:[],selection:{ids:papers.map(p=>p.id)},directory:dir,useAI:true,summarize:async()=>{throw Error('PROVIDER_ERROR');}}),/PROVIDER_ERROR/);assert.deepEqual(fs.readdirSync(dir),[]);}finally{remove(dir);}
});
test('taskbar properties use the app ID and an explicit physical icon/relaunch target',()=>{
 let details,icon;W.configureTaskbar({setIcon:p=>icon=p,setAppDetails:p=>details=p},{app:{},icon:'C:\\app\\resources\\PaperDesk.ico',exe:'C:\\app\\PaperDesk.exe'});assert.equal(icon,'C:\\app\\resources\\PaperDesk.ico');if(process.platform==='win32'){assert.equal(details.appId,W.APP_ID);assert.equal(details.appIconPath,icon);assert.equal(details.relaunchCommand,'"C:\\app\\PaperDesk.exe"');}
});
test('shortcut repair updates only this app and makes desktop/start/pinned identities consistent',()=>{
 const dir=temp();try{const pinned=path.join(dir,'Microsoft/Internet Explorer/Quick Launch/User Pinned/TaskBar');fs.mkdirSync(pinned,{recursive:true});fs.writeFileSync(path.join(pinned,'PaperDesk.lnk'),'');fs.writeFileSync(path.join(pinned,'Other.lnk'),'');const writes=[];
  const shell={readShortcutLink:p=>({target:p.endsWith('Other.lnk')?'C:\\other\\Other.exe':'C:\\old\\PaperDesk.exe',args:''}),writeShortcutLink:(file,mode,details)=>{writes.push({file,mode,details});return true;}};
  const result=W.repairShortcuts({app:{isPackaged:true,getPath:()=>dir},shell,icon:path.join(dir,'icon.ico'),exe:path.join(dir,'PaperDesk.exe')});if(process.platform==='win32'){assert.equal(result.updated,3);assert(writes.every(w=>w.details.appUserModelId===W.APP_ID));assert(!writes.some(w=>w.file.endsWith('Other.lnk')));}
 }finally{remove(dir);}
});
test('SerpApi receives the requested publication year bounds',async()=>{
 let requested;await P.searchScholar({groups:[['photonics']],journals:[],maxPages:1,yearFrom:2020,yearTo:2026},'dummy',{onProgress:()=>{},onPaper:()=>{},fetcher:async url=>{requested=new URL(url);return new Response(JSON.stringify({search_information:{organic_results_state:'Fully empty'}}));}});assert.equal(requested.searchParams.get('as_ylo'),'2020');assert.equal(requested.searchParams.get('as_yhi'),'2026');
});
