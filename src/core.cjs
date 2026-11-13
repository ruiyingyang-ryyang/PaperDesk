'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const text = (s, max = 20000) => String(s ?? '').slice(0, max);
const journalName = s => /^nature\s+photonics?$/i.test(s.trim()) ? 'Nature Photonics' : s.trim();
const norm = s => text(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const clean = s => text(s).replace(/<[^>]*>/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const cleanAbstract = s => {const content=clean(s);return content.replace(/^(?:(?:abstract|摘要)(?=\s|[:：.。\-–—]|$)[\s:：.。\-–—]*)+/i,'').trim()||content;};
const isTruncatedTitle=s=>/…|\.{3}/.test(String(s||''));
function mergeAuthorDetails(previous=[],next=[]){const result=[];for(const raw of [...previous,...next]){const name=clean(raw.name);if(!name)continue;const id=safeURL(raw.id),affiliations=[...new Map((raw.affiliations||[]).map(clean).filter(Boolean).map(s=>[norm(s),s])).values()];const old=result.find(a=>norm(a.name)===norm(name)&&(!a.id||!id||a.id===id));if(old){old.id ||= id;old.affiliations=[...new Map([...old.affiliations,...affiliations].map(s=>[norm(s),s])).values()];}else result.push({name,id,affiliations});}return result;}
function correspondingInstitutions(p){const names=new Set(corresponding(p).map(norm));return [...new Map((p.authorDetails||[]).filter(a=>names.has(norm(a.name))).flatMap(a=>a.affiliations||[]).map(clean).filter(Boolean).map(s=>[norm(s),s])).values()];}
function renameGroup(data,{scope,index,name}){if(!['manual','weekly'].includes(scope)||!Number.isInteger(index)||index<0||index>2||typeof name!=='string'||name.trim().length>80)throw Error('INVALID_GROUP_NAME');const settings=data.settings,target=scope==='weekly'?settings.weekly:settings;target.groupNames||=['','',''];target.groupNames[index]=name.trim();for(const p of data.papers)if(p.groupRefs?.includes(scope+':'+index)){p.groupLabels=[...new Set(p.groupRefs.map(ref=>{const [type,i]=ref.split(':'),config=type==='weekly'?settings.weekly:settings;return config.groupNames?.[Number(i)]||((settings.language==='en'?'Group ':'关键词组 ')+(Number(i)+1));}))];}return target.groupNames[index];}
function peopleList(value,maxLength=100){const list=[...new Set(String(value||'').split(/[;；\r\n]+/).map(s=>s.trim()).filter(Boolean))];if(list.length>10||list.some(s=>s.length>maxLength))throw Error('AUTHOR_LIST_LIMIT');return list;}
function monthOnly(value){const s=String(value||'').slice(0,7);return /^\d{4}-(0[1-9]|1[0-2])$/.test(s)&&Number(s.slice(0,4))>=1500?s:'';}
function defaults(){return {version:1,settings:{groups:[[],[],[]],groupNames:['','',''],journals:[],maxPages:50,language:'zh',enrich:true,scheduleEnabled:false,scheduleDay:5,scheduleTime:'08:00',scheduleEnabledAt:0,lastScheduleSuccess:0,authorName:'',authorSchool:'',authorRole:'either',yearFrom:null,yearTo:null,monthFrom:'',monthTo:'',deepseekModel:'deepseek-flash',aiProvider:'deepseek',gptModel:'gpt-4.1',writing:{journals:[],type:'期刊'},appearance:{theme:'light',fontSize:13},panelsCollapsed:{inbox:false,weekly:false,all:false,saved:false},weekly:{groups:[[],[],[]],groupNames:['','',''],journals:[],maxPages:50,authorName:'',authorSchool:'',authorRole:'either'}},papers:[],runs:[],chats:[],favoritePapers:[],gptUsage:[],deliveryLedger:[],secrets:{},dsAnalogyVersion:1};}
function safeURL(s) { try { const u = new URL(s); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
function doiFrom(s) { let d; try { d = decodeURIComponent(text(s)); } catch { d = text(s); } return (d.match(/10\.\d{4,9}\/[^\s?#<>]+/i)?.[0] || '').replace(/[.,;]+$/, '').toLowerCase(); }
function validateSettings(input) {
  if (!input || !Array.isArray(input.groups) || input.groups.length > 3) throw Error('GROUP_LIMIT');
  const groups = input.groups.map(g => {
    if (!Array.isArray(g) || g.length > 5) throw Error('WORD_LIMIT');
    return [...new Set(g.map(x => text(x, 100).trim()).filter(Boolean))];
  });
  if (!Array.isArray(input.journals) || input.journals.length > 30) throw Error('JOURNAL_LIMIT');
  const journals = [...new Set(input.journals.map(x => journalName(text(x, 200))).filter(Boolean))];
  const maxPages = Number(input.maxPages);
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 50) throw Error('PAGE_LIMIT');
  const groupNames = [0,1,2].map(i => text(input.groupNames?.[i], 80).trim());
  const year=v=>v===null||v===undefined||v===''?null:Number(v);
  const yearFrom=year(input.yearFrom),yearTo=year(input.yearTo);
  if([yearFrom,yearTo].some(v=>v!==null&&(!Number.isInteger(v)||v<1500||v>new Date().getFullYear()+1))||yearFrom&&yearTo&&yearFrom>yearTo)throw Error('INVALID_YEAR_RANGE');
  const monthFrom=input.monthFrom===undefined?(yearFrom?yearFrom+'-01':''):String(input.monthFrom||''),monthTo=input.monthTo===undefined?(yearTo?yearTo+'-12':''):String(input.monthTo||'');
  if([monthFrom,monthTo].some(v=>v&&(!monthOnly(v)||v!==monthOnly(v)||Number(v.slice(0,4))>new Date().getFullYear()+1))||monthFrom&&monthTo&&monthFrom>monthTo)throw Error('INVALID_MONTH_RANGE');
  const authorName=peopleList(input.authorName).join('; '),authorSchool=peopleList(input.authorSchool,200).join('; ');
  return {groups,groupNames,journals,maxPages,language:input.language==='en'?'en':'zh',enrich:true,authorName,authorSchool,authorRole:['first','corresponding'].includes(input.authorRole)?input.authorRole:'either',monthFrom,monthTo,yearFrom:monthFrom?Number(monthFrom.slice(0,4)):null,yearTo:monthTo?Number(monthTo.slice(0,4)):null,...scheduleParameters(input)};
}
function searchSettings(settings, weekly=false) {
  return validateSettings({...settings,...(weekly?settings.weekly:{}),...(weekly?{yearFrom:null,yearTo:null,monthFrom:'',monthTo:''}:{}),language:settings.language});
}
function queryFor(group, journal = '') {
  const quote = s => '"' + s.replace(/["\\]/g,' ').trim() + '"';
  return group.map(quote).join(' ') + (journal ? ' source:' + quote(journal) : '');
}
function queryPlan(settings) {
  const author=settings.authorName?'author:"'+settings.authorName.replace(/["\\]/g,' ')+'" ':'';
  const groups=settings.groups.some(g=>g.length)?settings.groups:author?[[]]:[];
  return groups.flatMap((g,i)=>(g.length||author)?(settings.journals.length?settings.journals:['']).map(j=>({group:i,journal:j,q:(author+queryFor(g,j)).trim()})):[]);
}
function paperId(p) { return crypto.createHash('sha256').update(p.doi ? 'doi:'+p.doi.toLowerCase() : 'title:'+norm(p.title)+'|'+norm(p.journal)+'|'+p.year).digest('hex').slice(0,24); }
function normalizePaper(raw) {
  const p = {
    title:clean(raw.title), doi:doiFrom(raw.doi || ''), url:safeURL(raw.url || raw.link),
    pdf:safeURL(raw.pdf), abstract:cleanAbstract(raw.abstract), snippet:clean(raw.snippet),
    journal:clean(raw.journal), year:text(raw.year,4),
    publicationDate:/^\d{4}-\d{2}-\d{2}$/.test(raw.publicationDate||'')?raw.publicationDate:'',
    publicationMonth:monthOnly(raw.publicationMonth||raw.publicationDate),
    authors:(Array.isArray(raw.authors) ? raw.authors : []).slice(0,5000).map((a,i)=>({name:clean(typeof a==='string'?a:a.name), first:typeof a.first==='boolean'?a.first:i===0, corresponding:!!a.corresponding, evidence:text(a.evidence,100)})).filter(a=>a.name),
    authorDetails:(Array.isArray(raw.authorDetails)?raw.authorDetails:[]).slice(0,5000).map(a=>({name:clean(a.name),id:safeURL(a.id),affiliations:(a.affiliations||[]).slice(0,20).map(clean)})),
    keywords:(Array.isArray(raw.keywords)?raw.keywords:[]).slice(0,100).map(x=>text(x,200)),
    topics:(Array.isArray(raw.topics)?raw.topics:[]).slice(0,100).map(x=>text(x,200)),
    sources:(Array.isArray(raw.sources)?raw.sources:[]).slice(0,10).map(x=>text(x,100)),
    metadataStatus:text(raw.metadataStatus || 'pending',100), metadataNote:text(raw.metadataNote,500),
    starred:!!raw.starred, read:!!raw.read,
    tags:(Array.isArray(raw.tags)?raw.tags:[]).slice(0,30).map(x=>text(x,80).trim()).filter(Boolean),
    manualCorresponding:Array.isArray(raw.manualCorresponding)?raw.manualCorresponding.slice(0,100).map(x=>text(x,200)):null,
    addedAt: Number.isFinite(raw.addedAt) ? raw.addedAt : Date.now(),
    groups:Array.isArray(raw.groups)?raw.groups.filter(x=>Number.isInteger(x)&&x>=0&&x<3):[],
    groupLabels:Array.isArray(raw.groupLabels)?raw.groupLabels.slice(0,12).map(x=>text(x,80)):[],
    groupRefs:Array.isArray(raw.groupRefs)?raw.groupRefs.filter(x=>/^(manual|weekly):[0-2]$/.test(x)):[],
    weeklyRuns:Array.isArray(raw.weeklyRuns)?raw.weeklyRuns.slice(0,100).map(x=>text(x,100)):[],
    weeklyDeliveries:Array.isArray(raw.weeklyDeliveries)?raw.weeklyDeliveries.slice(0,100).filter(x=>Number.isFinite(x.at)).map(x=>({at:x.at,week:text(x.week,10),runId:text(x.runId,100)})):[],
    authorSearches:Array.isArray(raw.authorSearches)?raw.authorSearches.slice(0,30).map(x=>({name:text(x.name,1200),school:text(x.school,2200),role:['first','corresponding'].includes(x.role)?x.role:'either'})):[],
    abstractViews:raw.abstractViews && typeof raw.abstractViews==='object' ? Object.fromEntries(['en','zh','ds'].filter(k=>typeof raw.abstractViews[k]==='string').map(k=>[k,text(raw.abstractViews[k],80000)])) : {},
    abstractViewsSource:text(raw.abstractViewsSource,80000)
  };
  if (!p.title) throw Error('EMPTY_TITLE');
  p.id = paperId(p); return p;
}
function fromScholar(r, group) {
  const summary=text(r.publication_info?.summary);
  const journal=summary.match(/\s[-–]\s(.+?),?\s*\b(?:19|20)\d{2}\b/)?.[1]?.replace(/[,\s]+$/,'')||'';
  return normalizePaper({title:r.title, link:r.link, snippet:r.snippet,
    authors:r.publication_info?.authors?.map(x=>({name:x.name,first:false,evidence:'Scholar author list; order not verified'})) || [],
    year:r.publication_info?.summary?.match(/\b(19|20)\d{2}\b/)?.[0] || '',
    journal,
    doi:doiFrom(r.link), pdf:r.resources?.find(x=>x.file_format==='PDF')?.link,
    sources:['Google Scholar / SerpApi'], groups:[group]});
}
function mergePaper(previous, next) {
  if (!previous) return next;
  const merged = {...previous, ...next, id:previous.id, starred:previous.starred, read:previous.read, tags:previous.tags,
    manualCorresponding:previous.manualCorresponding, addedAt:previous.addedAt,
    groups:[...new Set([...previous.groups,...next.groups])],sources:[...new Set([...previous.sources,...next.sources])],
    groupLabels:[...new Set([...(previous.groupLabels||[]),...(next.groupLabels||[])])],
    groupRefs:[...new Set([...(previous.groupRefs||[]),...(next.groupRefs||[])])],
    weeklyRuns:[...new Set([...(previous.weeklyRuns||[]),...(next.weeklyRuns||[])])],
    weeklyDeliveries:[...(previous.weeklyDeliveries||[]),...(next.weeklyDeliveries||[])].filter((x,i,a)=>a.findIndex(y=>y.runId===x.runId)===i),
    authorSearches:[...(previous.authorSearches||[]),...(next.authorSearches||[])].filter((x,i,a)=>a.findIndex(y=>JSON.stringify(y)===JSON.stringify(x))===i)};
  for (const field of ['doi','url','pdf','abstract','journal','year','publicationDate','publicationMonth']) if (!next[field]) merged[field]=previous[field];
  for (const field of ['authors','authorDetails','keywords','topics']) if (!next[field]?.length || (field==='authors' && next.metadataStatus==='pending' && previous.metadataStatus!=='pending')) merged[field]=previous[field];
  if (next.metadataStatus==='pending' && previous.metadataStatus!=='pending') {merged.metadataStatus=previous.metadataStatus;merged.metadataNote=previous.metadataNote;}
  if (merged.abstract === previous.abstract) {
    merged.abstractViews = {...(previous.abstractViews||{}), ...(next.abstractViewsSource===merged.abstract ? next.abstractViews : {})};
    merged.abstractViewsSource = previous.abstractViewsSource || '';
  } else { merged.abstractViews = {}; merged.abstractViewsSource = ''; }
  if(isTruncatedTitle(next.title)&&!isTruncatedTitle(previous.title))merged.title=previous.title;
  merged.authorDetails=mergeAuthorDetails(previous.authorDetails,next.authorDetails);
  return merged;
}
function upsert(papers, incoming) {
  const pos = papers.findIndex(p => {
    if(p.doi&&incoming.doi)return p.doi.toLowerCase()===incoming.doi.toLowerCase();
    return norm(p.title)===norm(incoming.title)&&(!p.journal||!incoming.journal||norm(p.journal)===norm(incoming.journal))&&(!p.year||!incoming.year||p.year===incoming.year);
  });
  if (pos<0) { papers.unshift(incoming); return {paper:incoming, added:true}; }
  papers[pos]=mergePaper(papers[pos],incoming);return {paper:papers[pos],added:false};
}
function journalMatch(p, journals) { return !!p.journal && journals.some(j=>norm(j)===norm(p.journal)); }
function corresponding(p) { return p.manualCorresponding !== null ? p.manualCorresponding : p.authors.filter(a=>a.corresponding).map(a=>a.name); }
function lastFriday(now=new Date()) { const d = new Date(now); d.setHours(8,0,0,0);d.setDate(d.getDate() - ((d.getDay()+2)%7));if(d>now)d.setDate(d.getDate()-7); return d; }
function nextFriday(now=new Date()) {const d=lastFriday(now);d.setDate(d.getDate()+7);return d;}
function scheduleParameters(s={}){const scheduleDay=s.scheduleDay===undefined?5:Number(s.scheduleDay),scheduleTime=s.scheduleTime===undefined?'08:00':s.scheduleTime;if(!Number.isInteger(scheduleDay)||scheduleDay<0||scheduleDay>6||typeof scheduleTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleTime))throw Error('INVALID_SCHEDULE_TIME');return {scheduleDay,scheduleTime};}
function lastScheduled(s={},now=new Date()){const p=scheduleParameters(s),[h,m]=p.scheduleTime.split(':').map(Number),d=new Date(now);d.setHours(h,m,0,0);d.setDate(d.getDate()-(d.getDay()-p.scheduleDay+7)%7);if(d>now)d.setDate(d.getDate()-7);return d;}
function nextScheduled(s={},now=new Date()){const d=lastScheduled(s,now);d.setDate(d.getDate()+7);return d;}
function scheduledDue(s, now=new Date()) {if(!s.scheduleEnabled)return null;const due=lastScheduled(s,now).getTime();return due>=s.scheduleEnabledAt && due>(s.lastScheduleSuccess||0) && (!s.retryAfter||now.getTime()>=s.retryAfter)?due:null;}
function csvCell(v) { const s=String(v ?? '');return '"'+(/^[\s]*[=+@\-]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"'; }
function exportCSV(papers,journals) {return '\uFEFF'+[['Title','Authors','Corresponding authors','Author keywords','Indexed topics','Abstract','Journal','Year','DOI','Original URL','PDF','Tags','Target journal','Sources'],...papers.map(p=>[p.title,p.authors.map(a=>a.name).join('; '),corresponding(p).join('; '),p.keywords.join('; '),p.topics.join('; '),p.abstract,p.journal,p.year,p.doi,p.url,p.pdf,p.tags.join('; '),journalMatch(p,journals)?'Yes':'',p.sources.join('; ')])].map(r=>r.map(csvCell).join(',')).join('\r\n');}
class Store {
  constructor(dir) {
    this.file=path.join(dir,'library.json');fs.mkdirSync(dir,{recursive:true});
    this.data=defaults();
    if(fs.existsSync(this.file)) {try {this.data=JSON.parse(fs.readFileSync(this.file,'utf8'));}catch {const backup=this.file+'.bak';if(!fs.existsSync(backup))throw Error('STORE_CORRUPT');this.data=JSON.parse(fs.readFileSync(backup,'utf8'));fs.copyFileSync(this.file,this.file+'.corrupt-'+Date.now());fs.copyFileSync(backup,this.file);}}
    if(!Array.isArray(this.data.papers)||!this.data.settings||!Array.isArray(this.data.runs)||this.data.version!==1)throw Error('STORE_CORRUPT');
    const s=this.data.settings;
    s.groupNames ||= ['','',''];
    // Clone legacy configuration once; later edits are independent.
    s.weekly ||= structuredClone({groups:s.groups,groupNames:s.groupNames,journals:s.journals,maxPages:s.maxPages});
    s.deepseekModel ||= 'deepseek-flash';s.aiProvider ||= 'deepseek';s.gptModel ||= 'gpt-4.1';s.writing ||= {journals:[],type:'期刊'};
    for(const config of [s,s.weekly,s.writing])config.journals=[...new Set((config.journals||[]).map(journalName))];
    s.appearance ||= {theme:'light',fontSize:13};
    s.panelsCollapsed ||= {inbox:false,weekly:false,all:false,saved:false};
    s.scheduleDay ??= 5;s.scheduleTime ||= '08:00';
    s.authorName ||= '';s.authorSchool ||= '';s.authorRole ||= 'either';
    s.yearFrom ??= null;s.yearTo ??= null;
    s.monthFrom ??= s.yearFrom?s.yearFrom+'-01':'';s.monthTo ??= s.yearTo?s.yearTo+'-12':'';
    s.weekly.authorName ||= '';s.weekly.authorSchool ||= '';s.weekly.authorRole ||= 'either';
    s.enrich=true;
    this.data.chats ||= [];this.data.favoritePapers ||= [];this.data.gptUsage ||= [];
    for(const chat of this.data.chats) for(const m of chat.messages||[]) if(m.status==='pending'){m.status='failed';m.error='AI_INTERRUPTED';}
    for(const p of this.data.papers){p.abstractViews ||= {};p.groupLabels ||= [];p.weeklyRuns||=[];p.weeklyDeliveries||=[];p.authorDetails||=[];p.authorSearches||=[];const cleaned=cleanAbstract(p.abstract);if(cleaned!==p.abstract){p.abstract=cleaned;p.abstractViews={};p.abstractViewsSource='';}}
    if(!this.data.dsAnalogyVersion){for(const p of this.data.papers)delete p.abstractViews.ds;this.data.dsAnalogyVersion=1;}
    for(const run of this.data.runs)if(run.scheduled)for(const id of run.paperIds||[]){const p=this.data.papers.find(x=>x.id===id);if(p&&!p.weeklyRuns.includes(run.id))p.weeklyRuns.push(run.id);}
    this.data.deliveryLedger||=[];
    const F=require('./features.cjs');
    for(const p of this.data.papers){if(!p.weeklyDeliveries.length){const delivery=F.deliveryFor(p,this.data.runs);if(delivery)p.weeklyDeliveries.push(delivery);}if(p.weeklyRuns.length&&!F.alreadyDelivered(p,this.data.deliveryLedger))this.data.deliveryLedger.push({doi:p.doi,title:p.title,journal:p.journal,year:p.year,at:p.weeklyDeliveries[0]?.at||p.addedAt});}
    if(this.data.secrets) delete this.data.secrets.openalex;
  }
  save() {const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.data));if(fs.existsSync(this.file))fs.copyFileSync(this.file,this.file+'.bak');fs.renameSync(tmp,this.file);}
  resetPreservingAPI(){const secrets=structuredClone(this.data.secrets||{}),model=this.data.settings.deepseekModel,aiProvider=this.data.settings.aiProvider,gptModel=this.data.settings.gptModel;this.data=defaults();this.data.secrets=secrets;if(model)this.data.settings.deepseekModel=model;this.data.settings.aiProvider=aiProvider||'deepseek';this.data.settings.gptModel=gptModel||'gpt-4.1';this.save();fs.writeFileSync(this.file+'.bak',JSON.stringify(this.data));for(const file of fs.readdirSync(path.dirname(this.file)))if(/^library\.json\.corrupt-\d+$/.test(file))fs.unlinkSync(path.join(path.dirname(this.file),file));return this.data;}
}
function removeChat(data,{id,messageId}){const chat=data.chats.find(c=>c.id===id);if(!chat)throw Error('NOT_FOUND');if(!messageId){data.chats=data.chats.filter(c=>c.id!==id);return;}const at=chat.messages.findIndex(m=>m.id===messageId&&m.role==='user');if(at<0)throw Error('NOT_FOUND');let end=at+1;while(end<chat.messages.length&&chat.messages[end].role!=='user')end++;const oldTitle=chat.messages[at].content.trim().slice(0,48);chat.messages.splice(at,end-at);if(!chat.messages.length)data.chats=data.chats.filter(c=>c.id!==id);else{if(chat.title===oldTitle)chat.title=chat.messages.find(m=>m.role==='user')?.content.trim().slice(0,48)||chat.title;chat.updatedAt=Date.now();}}
module.exports={text,journalName,norm,clean,cleanAbstract,isTruncatedTitle,mergeAuthorDetails,correspondingInstitutions,renameGroup,peopleList,monthOnly,removeChat,defaults,safeURL,doiFrom,validateSettings,searchSettings,queryFor,queryPlan,paperId,normalizePaper,fromScholar,mergePaper,upsert,journalMatch,corresponding,lastFriday,nextFriday,scheduleParameters,lastScheduled,nextScheduled,scheduledDue,csvCell,exportCSV,Store};
