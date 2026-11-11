'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require('playwright'),C=require('../src/core.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
  const profile=require('./test-paths.cjs').profile(root,'writing-modes-');
  const store=new C.Store(profile);store.save();
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({executablePath:process.env.PAPERDESK_TEST_EXE||require('electron'),args:[...(process.env.PAPERDESK_TEST_EXE?[]:[root]),'--paperdesk-test-profile='+profile],env,timeout:60000});
  try{
    const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.waitForSelector('.nav');
    await app.evaluate(()=>{
      globalThis.requests=[];
      globalThis.fetch=async(url,o={})=>{
        const body=JSON.parse(o.body);requests.push({url,body,authorized:o.headers.Authorization===(url.includes('openai.com')?'Bearer gpt-modes-test-only':'Bearer ds-modes-test-only')});
        const prompt=body.messages[0].content;
        const content=prompt.includes('润色译文')?'The measured efficiency reached 99%.':prompt.startsWith('将原文准确')?'The measured efficiency was 99%.':'实验测得的效率为 99%。';
        return new Response(JSON.stringify({choices:[{message:{content},finish_reason:'stop'}]}),{status:200});
      };
    });
    await page.click('.nav[data-view="settings"]');await page.fill('#gpt-key','gpt-modes-test-only');await page.fill('#deepseek-key','ds-modes-test-only');await page.click('[data-action="save-settings"]');
    await page.waitForFunction(async()=>{const s=await desk.call('get-state');return s.hasGptKey&&s.hasDeepseekKey;});
    await page.click('.nav[data-view="writing"]');
    await page.click('[data-journal="Nature Communications"]');await page.click('[data-journal="Nature Photonic"]');
    await page.fill('#writing-original','实验测得效率为99%。');
    assert.deepEqual(await page.locator('.writing-actions [data-action="writing-generate"]').allTextContents(),['润色','翻译','润色与翻译']);
    for(const provider of ['gpt','deepseek']){
      await page.selectOption('#writing-provider',provider);
      await page.selectOption('#writing-target',provider==='gpt'?'en':'zh');
      for(const mode of ['polish','translate','polish-translate']){
        await page.click('[data-action="writing-generate"][data-mode="'+mode+'"]');
        await page.waitForSelector('[data-action="writing-generate"][data-mode="'+mode+'"]:not(:disabled)');
        const request=(await app.evaluate(()=>globalThis.requests)).at(-1),prompt=request.body.messages[0].content;
        assert.equal(request.url,provider==='gpt'?'https://api.openai.com/v1/chat/completions':'https://api.deepseek.com/chat/completions');assert(request.authorized);
        assert.equal(request.body.messages[1].content,'实验测得效率为99%。');
        if(mode==='polish'){assert(prompt.includes('保留原文语言'));assert(prompt.includes('没有 AI 味'));assert(prompt.includes('Nature Communications、Nature Photonic'));}
        else{assert(prompt.includes(provider==='gpt'?'翻译为英文':'翻译为简体中文'));assert(mode==='translate'?prompt.includes('不额外扩写'):prompt.includes('润色译文'));}
        assert.equal(await page.inputValue('#writing-original'),'实验测得效率为99%。');
      }
      const state=await page.evaluate(()=>desk.call('get-state'));assert.equal(state.settings.aiProvider,'deepseek');assert.equal(state.settings.writing.provider,provider);
      if(provider==='gpt'){
        await page.locator('#toast').evaluate(e=>e.style.display='none');
        await page.locator('.writing-page').evaluate(e=>e.scrollTop=0);
        await page.screenshot({path:require('./test-paths.cjs').screenshot(root,'辅助写作-新版.png')});
        await page.click('[data-action="toggle-theme"]');await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
        await page.screenshot({path:require('./test-paths.cjs').screenshot(root,'辅助写作-夜间.png')});await page.click('[data-action="toggle-theme"]');
      }
    }
    const requests=await app.evaluate(()=>globalThis.requests);assert.equal(new Set(requests.map(r=>r.body.messages[0].content)).size,5);
    for(const [width,height] of [[1370,900],[1180,720],[800,650]]){
      await app.evaluate(({BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setSize(...size);},[width,height]);
      await page.waitForFunction(width=>window.innerWidth<=width,width);
      const layout=await page.evaluate(()=>{
        const r=e=>e.getBoundingClientRect();
        const navs=[...document.querySelectorAll('.sidebar .nav')],groups=[...document.querySelectorAll('.sidebar-group')];
        return {heights:navs.map(e=>r(e).height),iconX:navs.map(e=>r(e.querySelector('svg')).left),labelX:navs.map(e=>r(e.querySelector('span')).left),gaps:groups.flatMap(g=>[...g.querySelectorAll('.nav')].slice(1).map(e=>r(e).top-r(e.previousElementSibling).bottom)),groupGaps:groups.slice(1).map((g,i)=>r(g).top-r(groups[i]).bottom),actions:[...document.querySelectorAll('.writing-actions button')].map(e=>({top:r(e).top,bottom:r(e).bottom,right:r(e).right})),width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      for(const values of [layout.heights,layout.iconX,layout.labelX,layout.gaps,layout.groupGaps])assert(Math.max(...values)-Math.min(...values)<1,JSON.stringify(layout));
      assert(!layout.overflow);for(const b of layout.actions){assert(b.top>=0&&b.bottom<=layout.height+1&&b.right<=layout.width+1);}
      if(width===1180)await page.screenshot({path:require('./test-paths.cjs').screenshot(root,'辅助写作-紧凑窗口.png')});
    }
    await assert.rejects(()=>page.evaluate(()=>desk.call('writing-generate',{original:'text',journals:[],type:'期刊',mode:'invalid'})),/INVALID_WRITING_MODE/);
    const previous=await page.inputValue('#writing-result');
    await app.evaluate(()=>{globalThis.fetch=async(_url,o)=>new Promise((_resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));});
    await page.click('[data-action="writing-generate"][data-mode="translate"]');await page.waitForSelector('[data-action="writing-stop"]');
    assert.equal(await page.locator('.writing-actions [data-action="writing-generate"]:disabled').count(),3);assert(await page.locator('#writing-target').isDisabled());
    await page.click('[data-action="writing-stop"]');await page.waitForSelector('[data-action="writing-generate"][data-mode="translate"]:not(:disabled)');assert.equal(await page.inputValue('#writing-result'),previous);
    await page.reload();await page.waitForSelector('.nav');await page.click('.nav[data-view="writing"]');assert.equal(await page.inputValue('#writing-target'),'zh');
    assert.deepEqual(errors,[]);
    console.log('PASS packaged writing: all three modes on GPT/DS, distinct prompts, selected target, cancellation, persistent target, aligned sidebar and visible action bar at three window sizes');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
