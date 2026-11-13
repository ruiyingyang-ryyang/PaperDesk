'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
test('PDF selection styles cannot change the application sidebar or empty states',()=>{
 const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'src/index.html'),'utf8'),dom=new JSDOM(html);
 const styles=[...dom.window.document.querySelectorAll('link[rel="stylesheet"]')].map(e=>e.getAttribute('href'));
 assert(!styles.some(href=>href.includes('pdf_viewer.css')),'The upstream viewer includes unrelated sidebar and control styles');
 assert(styles.includes('pdf-text-layer.css'));
 const css=fs.readFileSync(path.join(root,'src/pdf-text-layer.css'),'utf8'),scope=new JSDOM('<style>'+css+'</style>');
 for(const rule of scope.window.document.styleSheets[0].cssRules)for(const selector of rule.selectorText.replace(/:is\([^)]*\)/g,'').split(','))assert(selector.trim().startsWith('#pdf-sheet'),'Unscoped PDF selector: '+selector);
 assert(css.includes('font-size: calc(var(--text-scale-factor) * var(--font-height))'),'Selectable text must still scale with the canvas');
 dom.window.close();scope.window.close();
});
