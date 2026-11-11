'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require('playwright'),C=require('../src/core.cjs');
const root=path.resolve(__dirname,'..');
const button=mode=>'[data-action="writing-generate"][data-mode="'+mode+'"]';
// Expected colors are the official Harness semantic values, not sampled from PaperDesk.
const themes={light:{base:'rgb(255, 255, 255)',side:'rgb(249, 250, 251)',control:'rgb(245, 246, 247)',primary:'rgb(15, 17, 21)',foreground:'rgb(255, 255, 255)',hover:'rgb(67, 69, 74)',chip:'rgb(235, 238, 242)',menu:'rgba(252, 253, 254, 0.7)'},dark:{base:'rgb(21, 21, 23)',side:'rgb(27, 27, 28)',control:'rgb(53, 54, 56)',primary:'rgb(249, 250, 251)',foreground:'rgb(15, 17, 21)',hover:'rgb(235, 238, 242)',chip:'rgb(67, 69, 74)',menu:'rgba(48, 49, 54, 0.64)'}};
(async()=>{
  const profile=require('./test-paths.cjs').profile(root,'writing-state-'),store=new C.Store(profile);store.save();
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({executablePath:process.env.PAPERDESK_TEST_EXE||require('electron'),args:[...(process.env.PAPERDESK_TEST_EXE?[]:[root]),'--paperdesk-test-profile='+profile],env,timeout:60000});
  try{
    const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('.nav');
    await app.evaluate(()=>{
      globalThis.fetch=async(_url,o)=>new Promise((resolve,reject)=>{globalThis.finishWriting=(status=200)=>resolve(new Response(JSON.stringify({choices:[{message:{content:'Verified passage.'},finish_reason:'stop'}]}),{status}));o.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});
    });
    await page.click('.nav[data-view="settings"]');await page.fill('#deepseek-key','ds-state-test-only');await page.click('[data-action="save-settings"]');await page.waitForFunction(async()=> (await desk.call('get-state')).hasDeepseekKey);
    await page.click('.nav[data-view="writing"]');await page.click('[data-journal="Nature Communications"]');await page.fill('#writing-original','A passage to revise.');
    for(const theme of ['light','dark']){
      if(theme==='dark'){await page.click('[data-action="toggle-theme"]');await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');}
      const expected=themes[theme];await page.mouse.move(0,0);await page.waitForFunction(color=>getComputedStyle(document.querySelector('.writing-journal-chip.active')).backgroundColor===color,expected.chip);
      assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),expected.base);
      assert.equal(await page.locator('.sidebar').evaluate(e=>getComputedStyle(e).backgroundColor),expected.side);
      assert.equal(await page.locator('#writing-original').evaluate(e=>getComputedStyle(e).backgroundColor),expected.control);
      assert.equal(await page.locator('.writing-journal-chip.active').evaluate(e=>getComputedStyle(e).backgroundColor),expected.chip);
      assert.equal(await page.locator('#writing-provider').evaluate(e=>getComputedStyle(e,'::picker(select)').backgroundColor),expected.menu);
      for(const mode of ['polish','translate','polish-translate']){
        await page.click(button(mode));await page.waitForSelector(button(mode)+'[aria-busy="true"]');
        await page.waitForFunction(()=>document.querySelector('.writing-action.is-selected')&&getComputedStyle(document.querySelector('.writing-action.is-selected')).opacity==='1');
        assert.equal(await page.locator('.writing-action.is-selected').count(),1);assert.equal(await page.locator('.writing-action[aria-pressed="true"]').getAttribute('data-mode'),mode);
        const during=await page.locator(button(mode)).evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,opacity:getComputedStyle(e).opacity}));
        assert.deepEqual(during,{background:expected.primary,color:expected.foreground,opacity:'1'});
        assert.equal(await page.locator('.writing-action:disabled').count(),3);
        await page.mouse.move(0,0);
        await app.evaluate((_e,status)=>finishWriting(status),theme==='dark'&&mode==='translate'?503:200);
        await page.waitForSelector(button(mode)+':not(:disabled)');
        assert.equal(await page.locator('.writing-action.is-selected').getAttribute('data-mode'),mode);
        assert.equal(await page.locator(button(mode)).evaluate(e=>getComputedStyle(e).backgroundColor),expected.primary);
        assert.equal(await page.locator('.writing-action:not(.is-selected)').first().evaluate(e=>getComputedStyle(e).backgroundColor),expected.control);
      }
      await page.locator(button('polish-translate')).hover();
      await page.waitForFunction(color=>getComputedStyle(document.querySelector('.writing-action.is-selected')).backgroundColor===color,expected.hover);
      await page.mouse.move(0,0);await page.locator('#toast').evaluate(e=>e.style.display='none');
      await page.locator('.writing-page').evaluate(e=>e.scrollTop=0);
      await page.screenshot({path:require('./test-paths.cjs').screenshot(root,'辅助写作-'+(theme==='light'?'新版':'夜间')+'.png')});
      await page.click('.nav[data-view="inbox"]');await page.click('.nav[data-view="writing"]');assert.equal(await page.locator('.writing-action.is-selected').getAttribute('data-mode'),'polish-translate');
    }
    await page.click(button('translate'));await page.waitForSelector(button('translate')+'[aria-busy="true"]');await page.click('[data-action="writing-stop"]');await page.waitForSelector(button('translate')+':not(:disabled)');assert.equal(await page.locator('.writing-action.is-selected').getAttribute('data-mode'),'translate');
    assert.deepEqual(errors,[]);
    console.log('PASS writing selection: each mode during/after request, error and cancel; official Harness colors in light/dark; hover and navigation retain the correct selected mode');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
