'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require('playwright'),C=require('../src/core.cjs'),paths=require('./test-paths.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const profile=paths.profile(root,'chat-search-'),store=new C.Store(profile);
 const messages=Array.from({length:25},(_,i)=>[{id:'q'+i,role:'user',content:i===8?'如何补偿 Atmospheric turbulence 对光通信的影响？':'研究问题 '+i},{id:'a'+i,role:'assistant',status:'complete',content:'演示回答。'.repeat(60)}]).flat();
 store.data.chats=[{id:'optics',title:'重命名后的研究笔记',updatedAt:Date.now(),messages},{id:'laser',title:'激光器设计',updatedAt:Date.now(),messages:[{id:'laser-q',role:'user',content:'如何设计激光器？'},{id:'laser-a',role:'assistant',status:'complete',content:'answer-only-needle'}]}];
 store.data.settings.writing={journals:['Nature Photonic'],type:'期刊'};store.save();
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:env.PAPERDESK_TEST_EXE||require('electron'),args:[...(env.PAPERDESK_TEST_EXE?[]:[root]),'--paperdesk-test-profile='+profile],env,timeout:60000});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('.nav');
  assert.equal(await app.evaluate(({app})=>app.getVersion()),'1.0.1');
  await page.click('[data-view="quick"]');await page.fill('#chat-input','保留的草稿');await page.fill('#chat-search','  ATMOSPHERIC  turbulence  ');
  assert.equal(await page.locator('.chat-history-item').count(),1);assert.equal(await page.inputValue('#chat-input'),'保留的草稿');assert((await page.locator('.chat-match-snippet').textContent()).includes('Atmospheric turbulence'));
  await page.click('.chat-open');assert.equal(await page.locator('.chat-search-target').getAttribute('data-message-id'),'q8');
  assert(await page.locator('.chat-search-target').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.chat-messages').getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom;}));
  await page.screenshot({path:paths.screenshot(root,'历史问题-内容搜索.png')});
  await page.fill('#chat-search','answer-only-needle');assert.equal(await page.locator('.chat-history-item').count(),0);assert(await page.locator('.chat-search-empty').isVisible());
  await page.click('[data-action="clear-chat-search"]');assert.equal(await page.locator('.chat-history-item').count(),2);
  await page.fill('#chat-search','激光器');await page.press('#chat-search','Escape');assert.equal(await page.inputValue('#chat-search'),'');
  for(const [width,height]of [[780,650],[560,650],[780,480]]){
   await app.evaluate(({BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setSize(...size);},[width,height]);
   await page.waitForFunction(w=>innerWidth<=w,width);await page.fill('#chat-search','turbulence');assert(await page.locator('#chat-search').isVisible());assert.equal(await page.locator('.chat-history-item').count(),1);assert(await page.locator('.chat-open').isVisible());
   assert(await page.locator('#chat-search').evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight;}));
  }
  await page.click('[data-action="toggle-theme"]');await page.screenshot({path:paths.screenshot(root,'历史问题-夜间紧凑.png')});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1300,850));
  await page.click('[data-view="settings"]');await page.fill('#deepseek-key','ds-test-only');await page.click('[data-action="save-settings"]');
  await app.evaluate(()=>{globalThis.capturedWriting=[];globalThis.fetch=async(_url,options)=>{capturedWriting.push(JSON.parse(options.body));return new Response(JSON.stringify({choices:[{message:{content:'Polished text.'},finish_reason:'stop'}]}),{status:200});};});
  await page.click('[data-view="writing"]');assert.equal(await page.inputValue('#writing-journals'),'Nature Photonics');assert.equal(await page.locator('[data-journal="Nature Photonics"][aria-pressed="true"]').count(),1);
  await page.fill('#writing-original','Measured efficiency reaches 99%.');await page.click('[data-mode="polish"][data-action="writing-generate"]');await page.waitForFunction(()=>document.querySelector('#writing-result').value==='Polished text.');
  const request=await app.evaluate(()=>capturedWriting.at(-1));assert(request.messages[0].content.includes('参考所选期刊Nature Photonics的语言表达风格'));assert.equal(request.messages[1].content,'Measured efficiency reaches 99%.');
  assert.deepEqual(errors,[]);console.log('PASS V1.0.0 desktop: history question search, follow-up jump, empty/clear/Escape, draft preservation, compact light/dark layout, legacy journal migration and corrected AI prompt; 0 renderer errors.');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
