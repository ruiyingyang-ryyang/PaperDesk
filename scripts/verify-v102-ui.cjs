'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),state={...require('../src/core.cjs').defaults(),running:false,hasSerpKey:true,hasGptKey:false,hasDeepseekKey:false,nextRun:Date.now(),activeAi:[],loadingAbstracts:[]};
(async()=>{
 const profile=require('./test-paths.cjs').profile(root,'v102-chrome-'),browser=await chromium.launchPersistentContext(profile,{executablePath:process.env.PAPERDESK_BROWSER_EXE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:1366,height:900},args:['--no-sandbox','--disable-gpu','--disable-background-networking']});
 try{
 const page=browser.pages()[0],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(data=>{const listeners={};window.testCalls=[];window.desk={on:(name,fn)=>listeners[name]=fn,call:async(name,input)=>{window.testCalls.push([name,input]);if(name==='save-settings')Object.assign(data.settings,input);if(name==='language')data.settings.language=input;if(['save-settings','language'].includes(name))listeners.state?.(structuredClone(data));return structuredClone(data);}};},state);
 await page.goto(pathToFileURL(path.join(root,'src/index.html')).href);await page.waitForSelector('.nav');await page.click('[data-view="settings"]');
 await page.fill('#group-0','dual comb, laser');await page.fill('#group-1','LASER, spectroscopy');await page.fill('#journals','Nature\nScience');assert.equal(await page.locator('#cost').textContent(),'300');
 await page.fill('#settings-author-name','Ming Li; Alice Chen');await page.fill('#settings-author-school','University A');await page.click('[data-action="save-settings"]');await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('一一对应'));assert.equal(await page.evaluate(()=>testCalls.filter(c=>c[0]==='save-settings').length),0);
 await page.fill('#settings-author-school','University A; University A');await page.click('[data-action="save-settings"]');await page.waitForFunction(()=>testCalls.filter(c=>c[0]==='save-settings').length===1);assert((await page.locator('.author-config .help').first().textContent()).includes('完整姓名'));
 await page.screenshot({path:require('./test-paths.cjs').screenshot(root,'v102-search-settings.png'),fullPage:true});
 await page.click('[data-view="schedule"]');await page.fill('#settings-author-name','Bob Smith');await page.fill('#settings-author-school','University B');await page.fill('#group-0','photonics, spectroscopy');await page.click('[data-action="save-settings"]');await page.waitForFunction(()=>testCalls.filter(c=>c[0]==='save-settings').length===2);
 const config=await page.evaluate(()=>testCalls.filter(c=>c[0]==='save-settings').at(-1)[1]);assert.equal(config.authorSchool,'University A; University A');assert.equal(config.weekly.authorSchool,'University B');
 await page.screenshot({path:require('./test-paths.cjs').screenshot(root,'v102-digest-settings.png'),fullPage:true});
 await page.click('[data-action="language"]');await page.waitForFunction(()=>document.querySelector('.author-config .help')?.textContent.includes('pairing them in order'));assert((await page.locator('.settings-grid').textContent()).includes('(OR)'));
 await page.setViewportSize({width:960,height:760});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS current Chrome: author pairing validation, independent manual/digest saves, keyword union cost, Chinese/English copy and narrow settings layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
