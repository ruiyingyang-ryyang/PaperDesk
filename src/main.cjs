'use strict';
const {app,BrowserWindow,ipcMain,session,Notification,Tray,Menu,nativeTheme,safeStorage,dialog,shell,powerMonitor}=require('electron');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');const Scheduler=require('./scheduler.cjs');
const F=require('./features.cjs'),W=require('./windows.cjs'),Reports=require('./weekly-export.cjs');
const C=require('./core.cjs');const P=require('./providers.cjs');const AI=require('./ai.cjs');const crypto=require('node:crypto');
const ChatExport=require('./chat-export.cjs'),Usage=require('./gpt-usage.cjs'),{Favorites}=require('./favorite-papers.cjs');
let favorites;
app.setName('PaperDesk');app.setAppUserModelId('PaperDesk.Research');
let win,tray,store,controller,running=false,resetting=false,quitting=false,progress=null;
const aiRequests=new Map();const abstractRequests=new Map();const titleRefreshAttempts=new Set();
// A separate profile lets release verification avoid touching the user's library.
const testProfile=process.argv.find(a=>a.startsWith('--paperdesk-test-profile='));
if(testProfile)app.setPath('userData',path.resolve(testProfile.slice('--paperdesk-test-profile='.length)));
if(testProfile)app.setAppUserModelId(W.APP_ID+'.Test');
const applicationIcon=()=>W.iconPath(app,process.resourcesPath,path.resolve(__dirname,'..'));
const uiURL=pathToFileURL(path.join(__dirname,'index.html')).href;
if(!app.requestSingleInstanceLock()){app.quit();}else {
  app.on('second-instance',(_e,args)=>{if(args.includes('--scheduled'))checkSchedule();else show();});
  app.whenReady().then(boot).catch(e=>{dialog.showErrorBox('PaperDesk',String(e.message));app.quit();});
}
function show(){if(!win)return;win.show();if(win.isMinimized())win.restore();win.focus();}
function send(channel,data){if(win&&!win.isDestroyed())win.webContents.send(channel,data);}
function snapshot(){const {secrets,...publicData}=store.data;return {...publicData,hasSerpKey:!!secrets?.serpapi,hasDeepseekKey:!!secrets?.deepseek,hasGptKey:!!secrets?.gpt,hasGptAdminKey:!!secrets?.gptAdmin,activeAi:[...aiRequests.keys()],loadingAbstracts:[...abstractRequests.keys()],running,progress,nextRun:C.nextScheduled(store.data.settings).getTime(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,platform:process.platform};}
function changed(){send('state',snapshot());}
function notify(body){const title='PaperDesk';if(Notification.isSupported()){const n=new Notification({title,body,icon:applicationIcon()});n.on('click',show);n.show();}else if(process.platform==='win32'&&tray)tray.displayBalloon({title,content:body,iconType:'info'});}
async function secret(name){const encrypted=store.data.secrets?.[name];if(!encrypted)return '';try{return (await safeStorage.decryptStringAsync(Buffer.from(encrypted,'base64'))).result;}catch{throw Error('KEY_DECRYPT_FAILED');}}
function trackUsage(record){Usage.record(store.data,record);store.save();}
async function activeAI(settings=store.data.settings){const options=AI.configuration(settings),key=await secret(options.provider);if(!key)throw Error(options.provider==='gpt'?'GPT_KEY_REQUIRED':'DEEPSEEK_KEY_REQUIRED');return {key,...options,...(options.provider==='gpt'?{onUsage:trackUsage}:{})};}
async function encryptedSecret(value){if(typeof value!=='string'||value.length>500)throw Error('INVALID_KEY');if(!value.trim())return '';if(!await safeStorage.isAsyncEncryptionAvailable())throw Error('SECURE_STORAGE_UNAVAILABLE');return (await safeStorage.encryptStringAsync(value.trim())).toString('base64');}
async function schedule(enable,preferences=store.data.settings){
  if(process.platform!=='win32')throw Error('WINDOWS_ONLY');
  if(!app.isPackaged)throw Error('PACKAGED_ONLY');
  const timing=C.scheduleParameters(preferences),s=store.data.settings;
  await Scheduler.update({enabled:enable,exe:process.execPath,...timing});
  const timingChanged=s.scheduleDay!==timing.scheduleDay||s.scheduleTime!==timing.scheduleTime;
  if(enable&&(!s.scheduleEnabled||timingChanged)){s.scheduleEnabledAt=Date.now();s.lastScheduleSuccess=0;s.retryAfter=0;}
  Object.assign(s,timing,{scheduleEnabled:enable,schedulePath:enable?process.execPath:'',scheduleTaskVersion:2});store.save();changed();return true;
}

async function checkSchedule(){if(!store||running||resetting)return;const due=C.scheduledDue(store.data.settings);if(due)await runSearch(due).catch(e=>{
  store.data.settings.retryAfter=Date.now()+3600000;store.data.runs.unshift({id:Date.now().toString(36),startedAt:Date.now(),endedAt:Date.now(),scheduled:true,status:'failed',added:0,received:0,pages:0,error:e.message});store.data.runs=store.data.runs.slice(0,100);store.save();changed();notify(store.data.settings.language==='zh'?'定时检索未能启动，请查看运行记录。':'Scheduled search could not start. Check Run history.');
});}
async function runSearch(due=null,author=null,weekly=!!due){
  if(running||resetting)throw Error('ALREADY_RUNNING');
  const s=C.searchSettings(store.data.settings,weekly);author ||= s.authorName?{name:s.authorName,school:s.authorSchool,role:s.authorRole}:null;
  if(!author&&!C.queryPlan(s).length)throw Error('KEYWORDS_REQUIRED');
  const startedAt=Date.now(),window=weekly?F.weeklyWindow(startedAt):null;
  if(weekly){s.yearFrom=Number(window.start.slice(0,4));s.yearTo=Number(window.end.slice(0,4));s.publicationWindow=window;}
  running=true;let key;try{key=await secret('serpapi');if(!key)throw Error('SERPAPI_KEY_REQUIRED');}catch(e){running=false;changed();throw e;}
  controller=new AbortController();
  const run={id:crypto.randomUUID(),startedAt,scheduled:weekly,trigger:due?'schedule':'manual',authorQuery:author,status:'running',added:0,received:0,delivered:0,pages:0,capped:[],queries:author?1:C.queryPlan(s).length,queryConfig:structuredClone(s),paperIds:[],rejected:0,excludedDate:0,excludedYear:0,duplicates:0,window};
  store.data.runs.unshift(run);store.data.runs=store.data.runs.slice(0,100);store.save();changed();
  try{
    const options={signal:controller.signal,onProgress:p=>{progress=p;send('progress',p);},onPaper:async raw=>{
      controller.signal.throwIfAborted();progress={phase:'metadata',current:run.received+1,total:run.received+1};send('progress',progress);
      const p=raw.metadataStatus==='checked'&&!C.isTruncatedTitle(raw.title)&&raw.journal&&raw.year&&(!weekly||raw.publicationDate)?raw:await P.enrichPaper(raw,controller.signal);
      if(weekly&&!F.publicationInWindow(p,window)){run.excludedDate++;return;}
      if(!weekly&&!F.inPublicationRange(p,s)){run.excludedYear++;return;}
      if(weekly&&F.alreadyDelivered(p,store.data.deliveryLedger)){run.duplicates++;return;}
      p.groupRefs=author?[]:p.groups.map(i=>(weekly?'weekly:':'manual:')+i);p.groupLabels=author?[]:p.groups.map(i=>(weekly?store.data.settings.weekly:store.data.settings).groupNames[i]||((s.language==='zh'?'关键词组 ':'Group ')+(i+1)));
      if(weekly){p.weeklyRuns=[run.id];p.weeklyDeliveries=[{at:startedAt,week:F.weekKey(startedAt),runId:run.id}];}
      const result=C.upsert(store.data.papers,p);run.received++;if(result.added)run.added++;
      if(weekly){store.data.deliveryLedger.push(F.deliveryRecord(result.paper,run));run.delivered++;}
      if(!run.paperIds.includes(result.paper.id))run.paperIds.push(result.paper.id);store.save();changed();
    }};
    const stats=await (author?P.searchAuthors(s,key,author,options):P.searchScholar(s,key,options));
    run.pages=stats.pages;run.queries=stats.queries;run.capped=stats.capped;run.rejected=stats.rejected||0;run.status=run.capped.length?'limited':'complete';
    if(due){store.data.settings.lastScheduleSuccess=due;store.data.settings.retryAfter=0;}
  }catch(e){run.status=controller.signal.aborted?'cancelled':'failed';run.error=controller.signal.aborted?'CANCELLED':e.message;if(due)store.data.settings.retryAfter=Date.now()+3600000;}
  finally{run.endedAt=Date.now();running=false;controller=null;progress=null;store.save();changed();if(weekly)notify(store.data.settings.language==='zh'?`每周推送：${run.delivered} 篇论文`:`Weekly digest: ${run.delivered} papers`);}
  return run;
}

function handle(name,fn){ipcMain.handle(name,async(e,...args)=>{
  if(e.sender!==win?.webContents||e.senderFrame!==win.webContents.mainFrame||e.senderFrame.url!==uiURL)throw Error('UNTRUSTED_CALLER');
  try{return {ok:true,value:await fn(...args)};}catch(err){return {ok:false,error:err.message||'UNKNOWN_ERROR'};}
});}
function wire(){
  handle('get-state',()=>snapshot());
  handle('chat-provider',provider=>{if(!['gpt','deepseek'].includes(provider))throw Error('INVALID_PROVIDER');if(aiRequests.size)throw Error('AI_BUSY');store.data.settings.chatProvider=provider;store.save();changed();return snapshot();});
  handle('chat-export',input=>ChatExport.exportChat({BrowserWindow,dialog,win,chats:store.data.chats,input,language:store.data.settings.language}));
  handle('favorite-upload',async()=>{const picked=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:'PDF',extensions:['pdf']}]});if(picked.canceled)return false;const result={added:0,duplicates:0,failed:0};for(const file of picked.filePaths){try{const r=favorites.add(file);r.added?result.added++:result.duplicates++;}catch{result.failed++;}}changed();return result;});
  handle('favorite-read',id=>new Uint8Array(favorites.read(id)));
  handle('favorite-update',input=>{favorites.update(input);changed();return snapshot();});
  handle('favorite-highlight',input=>{const paper=favorites.annotate(input);return structuredClone(paper);});
  handle('favorite-delete',input=>{favorites.remove(input);changed();return snapshot();});
  handle('save-settings',async input=>{if(running)throw Error('ALREADY_RUNNING');const valid=C.validateSettings(input);const weekly=C.validateSettings({...input.weekly,language:valid.language});const secrets={...store.data.secrets};
    const sk=await encryptedSecret(input.serpapiKey||'');const dk=await encryptedSecret(input.deepseekKey||'');const gk=await encryptedSecret(input.gptKey||'');const admin=await encryptedSecret(input.gptAdminKey||'');if(admin)secrets.gptAdmin=admin;if(input.clearGptAdmin)delete secrets.gptAdmin;if(gk)secrets.gpt=gk;if(input.clearGpt)delete secrets.gpt;AI.configuration(input);if(sk)secrets.serpapi=sk;if(dk)secrets.deepseek=dk;
    if(input.clearSerpapi)delete secrets.serpapi;if(input.clearDeepseek)delete secrets.deepseek;delete secrets.openalex;
    if(!AI.MODELS.includes(input.deepseekModel))throw Error('INVALID_MODEL');
    if(store.data.settings.scheduleEnabled&&(!secrets.serpapi||!C.queryPlan(weekly).length))throw Error('DISABLE_SCHEDULE_FIRST');
    if(store.data.settings.scheduleEnabled&&(valid.scheduleDay!==store.data.settings.scheduleDay||valid.scheduleTime!==store.data.settings.scheduleTime))await schedule(true,valid);
    store.data.secrets=secrets;Object.assign(store.data.settings,valid,{weekly,deepseekModel:input.deepseekModel,aiProvider:input.aiProvider||'deepseek',gptModel:input.gptModel||'gpt-4.1'});store.save();changed();return true;});
  handle('rename-group',input=>{C.renameGroup(store.data,input);store.save();changed();return snapshot();});
  handle('workspace-panel',input=>{if(!input||!['inbox','weekly','all','saved'].includes(input.view)||typeof input.collapsed!=='boolean')throw Error('INVALID_PANEL');store.data.settings.panelsCollapsed||={};store.data.settings.panelsCollapsed[input.view]=input.collapsed;store.save();changed();return snapshot();});
  handle('language',language=>{store.data.settings.language=language==='en'?'en':'zh';store.save();changed();return true;});
  handle('schedule',async enabled=>{if(enabled&&(!store.data.secrets.serpapi||!C.queryPlan(C.searchSettings(store.data.settings,true)).length))throw Error('SETUP_REQUIRED');return schedule(!!enabled);});
  handle('run',()=>{if(running)throw Error('ALREADY_RUNNING');runSearch().catch(e=>send('error',e.message));return true;});
  handle('run-weekly',()=>{if(running)throw Error('ALREADY_RUNNING');runSearch(null,null,true).catch(e=>send('error',e.message));return true;});
  handle('author-search',input=>{if(running)throw Error('ALREADY_RUNNING');if(!input||typeof input.name!=='string'||!input.name.trim()||typeof input.school!=='string'||!['first','corresponding','either'].includes(input.role))throw Error('INVALID_AUTHOR_SEARCH');C.peopleList(input.name);C.peopleList(input.school,200);const query={name:input.name.trim(),school:input.school.trim(),role:input.role};runSearch(null,query).catch(e=>send('error',e.message));return true;});
  handle('test-serpapi',async input=>{const key=input?.key?.trim()||await secret('serpapi');return P.testSerpapi(key);});
  handle('open-external',url=>{const safe=C.safeURL(url);if(!safe)throw Error('INVALID_URL');return shell.openExternal(safe);});
  handle('cancel',()=>{controller?.abort();return true;});
  handle('paper-update',({id,starred,read,tags,manualCorresponding})=>{
    const p=store.data.papers.find(p=>p.id===id);if(!p)throw Error('NOT_FOUND');
    if(typeof starred==='boolean')p.starred=starred;if(typeof read==='boolean')p.read=read;
    if(tags!==undefined){if(!Array.isArray(tags)||tags.length>30)throw Error('TAG_LIMIT');p.tags=[...new Set(tags.map(x=>C.text(x,80).trim()).filter(Boolean))];}
    if(manualCorresponding!==undefined){if(manualCorresponding===null)p.manualCorresponding=null;else if(Array.isArray(manualCorresponding)&&manualCorresponding.every(n=>p.authors.some(a=>a.name===n)))p.manualCorresponding=[...new Set(manualCorresponding)];else throw Error('INVALID_AUTHOR');}
    store.save();changed();return true;
  });
  handle('load-abstract',id=>ensureAbstract(id));
  handle('abstract-view',async({id,mode})=>{
    const p=store.data.papers.find(x=>x.id===id);if(!p)throw Error('NOT_FOUND');
    if(!['en','zh','ds'].includes(mode))throw Error('INVALID_ABSTRACT_MODE');
    await ensureAbstract(id);const paper=store.data.papers.find(x=>x.id===id);
    if(!paper.abstract)throw Error('NO_FULL_ABSTRACT');
    if(paper.abstractViewsSource===paper.abstract&&paper.abstractViews?.[mode])return paper.abstractViews[mode];
    const requestId='abstract:'+id+':'+mode;if(aiRequests.has(requestId))throw Error('AI_BUSY');
    const {key,...aiOptions}=await activeAI();
    const control=new AbortController();aiRequests.set(requestId,control);changed();
    const source=paper.abstract;
    try{const answer=await AI.complete(key,AI.abstractMessages(source,mode),{...aiOptions,signal:control.signal});
      const current=store.data.papers.find(x=>x.id===id);if(current.abstract!==source)throw Error('ABSTRACT_CHANGED');
      if(current.abstractViewsSource!==source)current.abstractViews={};current.abstractViewsSource=source;current.abstractViews[mode]=answer;store.save();return answer;
    }finally{aiRequests.delete(requestId);changed();}
  });
  handle('chat-send',async({id,question})=>{
    if(typeof question!=='string'||!question.trim()||question.length>12000)throw Error('INVALID_QUESTION');
    const {key,...aiOptions}=await activeAI({...store.data.settings,aiProvider:store.data.settings.chatProvider||store.data.settings.aiProvider});
    let chat=store.data.chats.find(c=>c.id===id);
    if(id&&!chat)throw Error('NOT_FOUND');
    if(!chat){chat={id:crypto.randomUUID(),title:question.trim().slice(0,48),createdAt:Date.now(),updatedAt:Date.now(),messages:[]};store.data.chats.unshift(chat);}
    if(aiRequests.has(chat.id))throw Error('AI_BUSY');
    const control=new AbortController();aiRequests.set(chat.id,control);
    chat.messages.push({id:crypto.randomUUID(),role:'user',content:question.trim(),createdAt:Date.now()});
    const answer={id:crypto.randomUUID(),role:'assistant',provider:aiOptions.provider,model:aiOptions.model,content:'',status:'pending',createdAt:Date.now()};chat.messages.push(answer);chat.updatedAt=Date.now();
    store.save();changed();
    try{answer.content=await AI.complete(key,AI.conversationMessages(chat),{...aiOptions,signal:control.signal});answer.status='complete';}
    catch(e){answer.status='failed';answer.error=e.message;}
    finally{aiRequests.delete(chat.id);chat.updatedAt=Date.now();store.save();changed();}
    return {id:chat.id,status:answer.status,error:answer.error};
  });
  handle('chat-rename',({id,title})=>{const chat=store.data.chats.find(c=>c.id===id);if(!chat)throw Error('NOT_FOUND');if(typeof title!=='string'||!title.trim()||title.length>80)throw Error('INVALID_TITLE');chat.title=title.trim();store.save();changed();return true;});
  handle('chat-delete',input=>{if(input?.confirm!==true)throw Error('DELETE_CONFIRM_REQUIRED');if(aiRequests.has(input.id))throw Error('AI_BUSY');C.removeChat(store.data,input);store.save();changed();return snapshot();});
  handle('writing-generate',async input=>{
    const messages=AI.writingMessages(input);if(aiRequests.has('writing'))throw Error('AI_BUSY');
    const provider=input.provider??store.data.settings.writing?.provider??store.data.settings.aiProvider;
    const {key,...options}=await activeAI({...store.data.settings,aiProvider:provider}),control=new AbortController();
    aiRequests.set('writing',control);
    store.data.settings.writing={journals:[...new Set(input.journals.map(C.journalName))],type:input.type,provider:options.provider,targetLanguage:input.targetLanguage??'en'};store.save();changed();
    try{return await AI.complete(key,messages,{...options,signal:control.signal});}
    finally{aiRequests.delete('writing');changed();}
  });
  handle('test-gpt',async input=>{const key=input?.key?.trim()||await secret('gpt');return AI.complete(key,[{role:'user',content:'Reply OK.'}],{provider:'gpt',model:input?.model||store.data.settings.gptModel||'gpt-4.1',onUsage:trackUsage});});
  handle('api-balance',async(input={})=>{const window=Usage.range(input.period||'month');const query=async(name,fetchBalance)=>{try{const key=await secret(name);if(!key)return {configured:false};return {configured:true,...await fetchBalance(key)};}catch(e){return {configured:true,error:e.message};}};const [deepseek,serpapi,gpt]=await Promise.all([query('deepseek',AI.balance),query('serpapi',P.testSerpapi),query('gptAdmin',key=>Usage.official(key,window))]);return {deepseek,serpapi,gpt:{...gpt,local:Usage.local(store.data,window),window},checkedAt:Date.now()};});
  handle('ai-cancel',id=>{aiRequests.get(id)?.abort();return true;});
  handle('test-deepseek',async input=>{const key=input?.key?.trim()||await secret('deepseek');if(!key)throw Error('DEEPSEEK_KEY_REQUIRED');let r;try{r=await fetch('https://api.deepseek.com/models',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});}catch{throw Error('NETWORK_ERROR');}if(!r.ok)throw Error(r.status===401?'DEEPSEEK_AUTH':'DEEPSEEK_HTTP_'+r.status);return true;});
  handle('export',async type=>{
    if(!['json','csv'].includes(type))throw Error('INVALID_FORMAT');
    const {canceled,filePath}=await dialog.showSaveDialog(win,{defaultPath:'PaperDesk-'+new Date().toISOString().slice(0,10)+'.'+type,filters:[{name:type.toUpperCase(),extensions:[type]}]});
    if(canceled)return false;const content=type==='csv'?C.exportCSV(store.data.papers,store.data.settings.journals):JSON.stringify({version:1,papers:store.data.papers,chats:store.data.chats,favoritePapers:favorites.backup()},null,2);fs.writeFileSync(filePath,content);return true;
  });
  handle('import',async()=>{if(running)throw Error('ALREADY_RUNNING');const {canceled,filePaths}=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'PaperDesk backup',extensions:['json']}]});if(canceled)return false;
    if(fs.statSync(filePaths[0]).size>700*1024*1024)throw Error('FILE_TOO_LARGE');const data=JSON.parse(fs.readFileSync(filePaths[0],'utf8'));if(data.version!==1||!Array.isArray(data.papers)||data.papers.length>50000)throw Error('INVALID_BACKUP');
    const normalized=data.papers.map(C.normalizePaper);if(data.favoritePapers)favorites.restore(data.favoritePapers);for(const p of normalized)C.upsert(store.data.papers,p);
    if(Array.isArray(data.chats))for(const c of data.chats.slice(0,5000)){if(typeof c.id!=='string'||!Array.isArray(c.messages)||store.data.chats.some(x=>x.id===c.id))continue;store.data.chats.push({id:C.text(c.id,100),title:C.text(c.title,80),createdAt:Number(c.createdAt)||Date.now(),updatedAt:Number(c.updatedAt)||Date.now(),messages:c.messages.slice(0,1000).filter(m=>['user','assistant'].includes(m.role)).map(m=>({id:crypto.randomUUID(),role:m.role,provider:['deepseek','gpt'].includes(m.provider)?m.provider:undefined,model:C.text(m.model,100),content:C.text(m.content,100000),status:m.role==='assistant'?(m.status==='complete'?'complete':'failed'):undefined,error:m.status==='complete'?undefined:'AI_INTERRUPTED'}))});}store.save();changed();return normalized.length;
  });
  handle('appearance',input=>{if(!input||!['light','dark'].includes(input.theme)||!Number.isInteger(input.fontSize)||input.fontSize<11||input.fontSize>20)throw Error('INVALID_APPEARANCE');store.data.settings.appearance={theme:input.theme,fontSize:input.fontSize};nativeTheme.themeSource=input.theme;store.save();changed();return snapshot();});
  handle('reset-app',async input=>{if(input?.confirm!==true)throw Error('RESET_CONFIRM_REQUIRED');if(running||resetting||aiRequests.size||abstractRequests.size)throw Error('RESET_BUSY');resetting=true;try{if(store.data.settings.scheduleEnabled)await schedule(false);store.resetPreservingAPI();favorites.clear();titleRefreshAttempts.clear();nativeTheme.themeSource='light';progress=null;changed();return snapshot();}finally{resetting=false;}});
  handle('export-weekly-md',async input=>{
    if(aiRequests.has('weekly-export'))throw Error('AI_BUSY');
    const chosen=F.selectWeekly(store.data.papers,store.data.runs,input);if(!chosen.length)throw Error('EXPORT_SELECTION_REQUIRED');
    const {key,...aiOptions}=input.useAI?await activeAI():{};
    const picked=await dialog.showOpenDialog(win,{title:'导出每周推送 Markdown',properties:['openDirectory','createDirectory']});if(picked.canceled)return false;
    const control=new AbortController();aiRequests.set('weekly-export',control);changed();
    try{return await Reports.exportWeekly({papers:structuredClone(store.data.papers),runs:structuredClone(store.data.runs),selection:input,directory:picked.filePaths[0],useAI:!!input.useAI,signal:control.signal,summarize:(messages,signal)=>AI.complete(key,messages,{...aiOptions,signal}),onProgress:p=>send('export-progress',p)});}
    finally{aiRequests.delete('weekly-export');changed();}
  });

  handle('quit',()=>{quitting=true;app.quit();return true;});
}
async function ensureAbstract(id){
  const p=store.data.papers.find(x=>x.id===id);if(!p)throw Error('NOT_FOUND');if(p.abstract&&(!C.isTruncatedTitle(p.title)||titleRefreshAttempts.has(id)))return true;
  if(abstractRequests.has(id))return abstractRequests.get(id);
  if(C.isTruncatedTitle(p.title))titleRefreshAttempts.add(id);
  const task=(async()=>{const rich=await P.enrichPaper(p,AbortSignal.timeout(45000));const i=store.data.papers.findIndex(x=>x.id===id);if(i>=0)store.data.papers[i]=C.mergePaper(store.data.papers[i],rich);store.save();return !!rich.abstract;})();
  abstractRequests.set(id,task);changed();try{return await task;}finally{abstractRequests.delete(id);changed();}
}
async function boot(){
  store=new C.Store(app.getPath('userData'));store.data.secrets ||= {};
  favorites=new Favorites(store);
  nativeTheme.themeSource=store.data.settings.appearance.theme==='dark'?'dark':'light';
  for(const r of store.data.runs)if(r.status==='running'){r.status='interrupted';r.error='INTERRUPTED';r.endedAt=Date.now();}store.save();
  win=new BrowserWindow({width:1370,height:900,minWidth:420,minHeight:420,resizable:true,maximizable:true,thickFrame:true,backgroundColor:'#f6f6f7',autoHideMenuBar:true,title:'PaperDesk',icon:applicationIcon(),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  W.configureTaskbar(win,{app,icon:applicationIcon(),testProfile:!!testProfile});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
  session.defaultSession.setPermissionRequestHandler((_wc,_perm,cb)=>cb(false));session.defaultSession.setPermissionCheckHandler(()=>false);
  wire();await win.loadFile(path.join(__dirname,'index.html'));
  tray=new Tray(applicationIcon());tray.setToolTip('PaperDesk');tray.setContextMenu(Menu.buildFromTemplate([{label:'打开 PaperDesk / Open',click:show},{label:'退出 / Quit',click:()=>{quitting=true;app.quit();}}]));tray.on('double-click',show);
  win.on('close',e=>{if(!quitting){e.preventDefault();win.hide();}});
  W.repairShortcuts({app,shell,icon:applicationIcon(),testProfile:!!testProfile});
  if(!testProfile&&app.isPackaged&&store.data.settings.scheduleEnabled&&store.data.settings.scheduleTaskVersion!==2)await schedule(true).catch(()=>send('error','SCHEDULE_REGISTER_FAILED'));
  if(!process.argv.includes('--scheduled'))show();
  setInterval(()=>checkSchedule().catch(()=>{}),30000);powerMonitor.on('resume',()=>checkSchedule().catch(()=>{}));await checkSchedule();
}
app.on('before-quit',()=>{quitting=true;controller?.abort();for(const c of aiRequests.values())c.abort();});
app.on('window-all-closed',()=>{if(quitting)app.quit();});
