'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require('playwright'),C=require('../src/core.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
  const profile=require('./test-paths.cjs').profile(root,'weekly-date-'),store=new C.Store(profile);
  store.data.papers=[28,29].map(d=>C.normalizePaper({title:'Weekly paper February '+d,weeklyRuns:['r'],weeklyDeliveries:[{at:new Date(2024,1,d,12).getTime(),week:'2024-02-26',runId:'r'}]}));store.save();
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({executablePath:process.env.PAPERDESK_TEST_EXE||require('electron'),args:[...(process.env.PAPERDESK_TEST_EXE?[]:[root]),'--paperdesk-test-profile='+profile],env,timeout:60000});
  try{
    const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('.nav');
    await page.click('.nav[data-view="weekly"]');assert.equal(await page.locator('.paper-card').count(),2);assert.equal(await page.locator('input[type="date"]').count(),0);
    const reference=await page.locator('#week-filter').evaluate(e=>{const s=getComputedStyle(e);return {height:s.height,radius:s.borderRadius,background:s.backgroundColor,font:s.fontSize};});
    assert.deepEqual(await page.locator('#weekly-from-trigger').evaluate(e=>{const s=getComputedStyle(e);return {height:s.height,radius:s.borderRadius,background:s.backgroundColor,font:s.fontSize};}),reference);
    async function month(year,value){await page.fill('#date-picker-year',String(year));await page.locator('#date-picker-year').dispatchEvent('change');await page.selectOption('#date-picker-month',String(value));}
    await page.click('#weekly-from-trigger');await month(2024,2);assert.equal(await page.locator('.date-day').count(),29);await page.click('.date-day[data-day="29"]');assert.equal(await page.locator('.date-day.is-selected').getAttribute('data-day'),'29');
    await page.mouse.move(0,0);await page.locator('#toast').evaluate(e=>e.style.display='none');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.date-day.is-selected')).backgroundColor==='rgb(15, 17, 21)');
    await page.screenshot({path:require('./test-paths.cjs').screenshot(root,'每周推送-日期选择.png')});
    await page.click('[data-action="apply-date"]');assert.equal(await page.inputValue('#weekly-from'),'2024-02-29');assert.equal(await page.locator('.paper-card').count(),1);assert.equal(await page.evaluate(()=>document.activeElement.id),'weekly-from-trigger');
    await page.click('#weekly-from-trigger');await page.click('.date-day[data-day="28"]');assert.equal(await page.locator('.date-day.is-selected').getAttribute('data-day'),'28');await page.keyboard.press('Escape');assert.equal(await page.inputValue('#weekly-from'),'2024-02-29');
    await page.click('#weekly-from-trigger');await page.click('[data-action="clear-date"]');assert.equal(await page.locator('.paper-card').count(),2);
    await page.click('[data-action="toggle-theme"]');await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    await page.click('#weekly-to-trigger');await month(2024,2);await page.click('.date-day[data-day="28"]');await page.mouse.move(0,0);
    assert.equal(await page.locator('.date-picker-modal').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(35, 35, 36)');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.date-day.is-selected')).backgroundColor==='rgb(249, 250, 251)');
    assert.equal(await page.locator('#date-picker-month').evaluate(e=>getComputedStyle(e,'::picker(select)').backgroundColor),'rgba(48, 49, 54, 0.64)');
    await page.screenshot({path:require('./test-paths.cjs').screenshot(root,'每周推送-日期选择-夜间.png')});
    await page.click('[data-action="apply-date"]');assert.equal(await page.inputValue('#weekly-to'),'2024-02-28');assert.equal(await page.locator('.paper-card').count(),1);assert.equal(await page.evaluate(()=>document.activeElement.id),'weekly-to-trigger');
    await page.click('#weekly-to-trigger');await page.click('[data-action="date-month-prev"]');assert.equal(await page.inputValue('#date-picker-month'),'1');await page.click('[data-action="date-month-next"]');assert.equal(await page.inputValue('#date-picker-month'),'2');
    await page.keyboard.press('Escape');assert.equal(await page.inputValue('#weekly-to'),'2024-02-28');
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setSize(560,650);});
    await page.waitForFunction(()=>innerWidth<=560);await page.click('#weekly-to-trigger');
    assert(await page.locator('[data-action="apply-date"]').isVisible());assert(await page.locator('#date-picker-month').isVisible());
    const bounds=await page.locator('.date-picker-modal').evaluate(e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:innerWidth,height:innerHeight};});assert(bounds.left>=0&&bounds.top>=0&&bounds.right<=bounds.width&&bounds.bottom<=bounds.height);
    assert.deepEqual(errors,[]);console.log('PASS weekly date picker: shared control style, light/dark calendar and menu colors, leap-day filtering, clear/cancel, focus return and compact layout');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
