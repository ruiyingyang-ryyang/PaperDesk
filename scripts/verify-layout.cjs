'use strict';
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),{pathToFileURL}=require('url'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),fixture=require('./test-paths.cjs').profile(root,'layout-browser-'),chrome=process.env.PAPERDESK_BROWSER_EXE||'C:/Program Files/Google/Chrome/Application/chrome.exe';
for(const entry of ['src','assets'])fs.cpSync(path.join(root,entry),path.join(fixture,entry),{recursive:true});
const base=fs.readFileSync(path.join(root,'src/index.html'),'utf8'),state={...require('../src/core.cjs').defaults(),activeAi:[],loadingAbstracts:[],running:false,nextRun:Date.now(),hasGptKey:false,hasDeepseekKey:false,hasSerpKey:false};
function browserFixture(data){
 const handlers={};let queries=0;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 window.desk={on:(name,fn)=>handlers[name]=fn,call:async(name,input)=>{
  if(name==='api-balance'){queries++;await sleep(30);return {deepseek:{configured:false},serpapi:{configured:false},gpt:{configured:false,local:{requests:4,reportedRequests:4,inputTokens:123,outputTokens:45,cachedTokens:0}},checkedAt:Date.now()};}
  if(name==='appearance')Object.assign(data.settings.appearance,input);if(name==='language')data.settings.language=input;
  if(name==='appearance'||name==='language')handlers.state?.(structuredClone(data));return structuredClone(data);
 }};
 window.addEventListener('load',async()=>{
  const p=new URLSearchParams(location.search);await window.desk.call('appearance',{theme:p.get('theme')||'light',fontSize:Number(p.get('font'))||13});
  document.querySelector('[data-view="'+(p.get('view')||'favorites')+'"]').click();await sleep(100);
  const side=document.querySelector('#app>.sidebar'),shell=document.querySelector('#app>.shell'),heading=document.querySelector('.page-heading'),s=side.getBoundingClientRect(),m=shell.getBoundingClientRect();
  const out={position:getComputedStyle(side).position,sideTop:s.top,sideBottom:s.bottom,sideRight:s.right,shellTop:m.top,shellLeft:m.left,headingTop:heading.getBoundingClientRect().top,scrollY,viewport:innerHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
  if(p.get('dialog')){
   document.querySelector('[data-action="api-balance"]').click();await sleep(100);
   const dialog=document.querySelector('.modal'),backdrop=document.querySelector('.modal-backdrop');
   document.querySelector('[data-action="refresh-balance"]').click();document.querySelector('[data-action="refresh-balance"]').click();await sleep(100);
   const body=document.querySelector('.balance-modal-body');body.scrollTop=body.scrollHeight;
   out.dialog={count:document.querySelectorAll('[role="dialog"]').length,stable:dialog===document.querySelector('.modal')&&backdrop===document.querySelector('.modal-backdrop'),queries,box:dialog.getBoundingClientRect().toJSON(),button:document.querySelector('[data-action="refresh-balance"]').getBoundingClientRect().toJSON(),footer:document.querySelector('.balance-modal-footer').getBoundingClientRect().toJSON(),body:body.getBoundingClientRect().toJSON()};
  }
  const report=document.createElement('pre');report.id='layout-test-results';report.style='position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';report.textContent=JSON.stringify(out);document.body.append(report);
 });
}
const adapter='('+browserFixture.toString()+')('+JSON.stringify(state)+');';
fs.writeFileSync(path.join(fixture,'src/layout-fixture.js'),adapter);
async function run(name,{before=false,width=1366,height=768,font=13,theme='light',view='favorites',dialog=false}={}){
 const html=(before?base.replace('href="pdf-text-layer.css"','href="../assets/vendor/pdfjs/web/pdf_viewer.css"'):base).replace('<script src="ui.js">','<script src="layout-fixture.js"></script><script src="ui.js">');fs.writeFileSync(path.join(fixture,'src/index.html'),html);
 const url=pathToFileURL(path.join(fixture,'src/index.html'));url.search=new URLSearchParams({view,font:String(font),theme,...(dialog?{dialog:'balance'}:{})}).toString();const screenshot=path.join(root,'screenshots-current',name+'.png');
 const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update','--no-first-run','--no-default-browser-check','--user-data-dir='+path.join(fixture,'browser-'+name),'--window-size='+width+','+height,'--virtual-time-budget=3000','--screenshot='+screenshot,'--dump-dom',url.href];
 const output=await new Promise((resolve,reject)=>{const child=spawn(chrome,args,{windowsHide:true});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);const timer=setTimeout(()=>{child.kill();reject(Error('Chrome timed out: '+name));},25000);child.on('close',code=>{clearTimeout(timer);code===0?resolve(stdout):reject(Error(name+' exited '+code+': '+stderr.slice(-500)));});});
 const match=output.match(/<pre id="layout-test-results"[^>]*>(.*?)<\/pre>/s);if(!match)throw Error('Missing browser report: '+name+' '+output.slice(-300));const report=JSON.parse(match[1]);console.log(name,report);
 if(before){assert(report.position!=='fixed'||report.shellTop>1,'Regression fixture did not reproduce the layout issue');return;}
 assert.equal(report.position,'fixed');assert(Math.abs(report.sideTop)<1);assert(Math.abs(report.shellTop)<1);assert(Math.abs(report.sideBottom-report.viewport)<1);assert(report.shellLeft>=report.sideRight-1);assert(report.headingTop<130);assert.equal(report.scrollY,0);assert(report.scrollWidth<=report.width+1);if(dialog){const d=report.dialog;assert.equal(d.count,1);assert(d.stable);assert.equal(d.queries,2);assert(d.button.right<=d.box.right-12);assert(d.button.bottom<=d.box.bottom-12);assert(d.button.top>=d.footer.top-1);assert(d.footer.top>=d.body.bottom-1);assert(d.box.top>=10&&d.box.bottom<=report.viewport-10);}
}
(async()=>{await run('layout-before',{before:true});await run('layout-fixed-desktop');await run('layout-fixed-dark',{width:1280,height:720,font:16,theme:'dark'});await run('layout-fixed-large-font',{width:960,height:650,font:20,view:'inbox'});await run('layout-fixed-narrow',{width:420,height:760,font:13,view:'favorites'});await run('dialog-fixed-desktop',{width:1370,height:900,font:16,dialog:true});await run('dialog-fixed-compact',{width:960,height:500,font:20,dialog:true});await run('dialog-fixed-dark',{width:600,height:700,font:16,theme:'dark',dialog:true});console.log('PASS current Chrome: 4 workspace layouts and 3 singleton dialogs with contained refresh controls.');})().catch(e=>{console.error(e);process.exitCode=1;});
