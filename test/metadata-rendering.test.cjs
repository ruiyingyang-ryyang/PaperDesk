'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {JSDOM}=require('jsdom');
const C=require('../src/core.cjs'),P=require('../src/providers.cjs'),AI=require('../src/ai.cjs'),{publisherMetadata}=require('../src/publisher.cjs');
const ok=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
test('SerpApi account test consumes no search query and never exposes account details',async()=>{
 const r=await P.testSerpapi('sample',{fetcher:async u=>{assert.equal(u.pathname,'/account.json');assert.equal(u.searchParams.get('api_key'),'sample');return ok({account_id:'account',total_searches_left:23,email:'private@example.org'});}});assert.deepEqual(r,{remaining:23});
 await assert.rejects(()=>P.testSerpapi('wrong',{fetcher:async()=>ok({error:'invalid wrong'})}),/SERPAPI_AUTH/);
 await assert.rejects(()=>P.testSerpapi('',{}),/SERPAPI_KEY_REQUIRED/);
});
test('publisher metadata uses matching DOI/title and explicitly declared correspondence',()=>{
 const html=`<meta name='citation_doi' content='10.1000/test'><meta content='Test' name='citation_title'><meta name='citation_journal_title' content='Nature Photonics'><meta name='citation_publication_date' content='2026/01/01'><meta name='citation_author' content='Alice Chen'><meta name='citation_author_institution' content='Test University'><meta name='citation_author' content='Ming Li'><meta name='citation_author_is_corresponding' content='true'><meta name='citation_author_institution' content='Test University'><meta name='citation_abstract' content='Full &amp; complete abstract'>`;
 const p=publisherMetadata(html,{title:'Test',doi:'10.1000/test'});assert.equal(p.year,'2026');assert.equal(p.journal,'Nature Photonics');assert.equal(p.authors[0].first,true);assert.equal(p.authors[0].corresponding,false);assert.equal(p.authors[1].corresponding,true);assert.equal(p.authorDetails[1].affiliations[0],'Test University');assert.equal(p.abstract,'Full & complete abstract');
 assert.equal(publisherMetadata(html,{title:'Other',doi:'10.1000/other'}),null);
});
test('author search requires the same author identity, institution and requested role',()=>{
 const p=C.normalizePaper({title:'A',authors:[{name:'Alice',first:true},{name:'Ming',first:false,corresponding:true}],authorDetails:[{name:'Alice',affiliations:['University A']},{name:'Ming',affiliations:['University B']}]});
 assert(P.matchesAuthor(p,{name:'Ming',school:'University B',role:'corresponding'}));assert(!P.matchesAuthor(p,{name:'Ming',school:'University A',role:'corresponding'}));assert(!P.matchesAuthor(p,{name:'Ming',school:'University B',role:'first'}));assert(P.matchesAuthor(p,{name:'Alice',school:'University A',role:'first'}));
});
test('OpenAlex author route filters explicit first/corresponding roles without SerpApi spend',async()=>{
 const matches=[];const author={name:'Ming Li',school:'Test University',role:'either'};
 const stats=await P.searchAuthor({groups:[],journals:[],maxPages:1},'key',author,{onProgress:()=>{},onPaper:p=>matches.push(p),fetcher:async u=>{
  const url=new URL(u);if(url.pathname==='/authors')return ok({results:[{id:'https://openalex.org/A1',display_name:'Ming Li',last_known_institutions:[{display_name:'Test University'}]}]});
  assert.equal(url.hostname,'api.openalex.org');assert(url.searchParams.get('filter').includes('A1'));
  return ok({meta:{count:3},results:['first','middle','last'].map((pos,i)=>({display_name:'Paper '+i,doi:'https://doi.org/10.1000/'+i,publication_year:2026,primary_location:{source:{display_name:'Nature'}},authorships:[{author:{id:'https://openalex.org/A1',display_name:'Ming Li'},author_position:pos,is_corresponding:pos==='last',institutions:[{display_name:'Test University'}]}]}))});
 }});assert.equal(matches.length,2);assert.equal(stats.rejected,1);assert(matches.every(p=>p.authorSearches[0].name==='Ming Li'));
});
test('weekly associations persist for old records and survive repeated general search',()=>{
 const p=C.normalizePaper({title:'A',weeklyRuns:['week-1'],groupRefs:['weekly:0']});const merged=C.mergePaper(p,C.normalizePaper({title:'A',groupRefs:['manual:0']}));assert.deepEqual(merged.weeklyRuns,['week-1']);assert.deepEqual(merged.groupRefs,['weekly:0','manual:0']);
});
test('DS asks for analogies and explicit boundaries, including Markdown/LaTeX format',()=>{
 const messages=AI.abstractMessages('Full abstract','ds');assert(messages[0].content.includes('比喻'));assert(messages[0].content.includes('边界'));assert(messages[0].content.includes('LaTeX'));
});
function richFixture(){const dom=new JSDOM('<!doctype html><div id="text"></div>',{runScripts:'outside-only'});const w=dom.window;for(const p of ['assets/vendor/marked/marked.umd.js','assets/vendor/dompurify/purify.min.js','assets/vendor/katex/katex.min.js','src/richtext.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));return dom;}
test('DeepSeek content renders Markdown and bracket/dollar formulas without losing backslashes',()=>{
 const dom=richFixture(),w=dom.window,el=w.document.querySelector('#text');try{w.PaperDeskRichText.render(el,'**Bold** and \\(E=mc^2\\)\n\n\\[\\frac{a_1}{b^2}\\]\n\n$\\alpha$\n\n$$\\sum_{i=1}^n i$$\n\n- item\n\n| A | B |\n|---|---|\n| 1 | 2 |');assert.equal(el.querySelector('strong').textContent,'Bold');assert.equal(el.querySelectorAll('.katex').length,4);assert.equal(el.querySelectorAll('.katex-error').length,0);assert(el.querySelector('li'));assert(el.querySelector('table'));}finally{dom.window.close();}
});
test('model text cannot run scripts, fetch images or create executable links',()=>{
 const dom=richFixture(),w=dom.window,el=w.document.querySelector('#text');try{w.PaperDeskRichText.render(el,'<img src="https://example.org/track" onerror="alert(1)"><script>alert(1)</script>\n\n[bad](javascript:alert(1)) ![remote](https://example.org/image)\n\n[good](https://example.org/paper)');assert.equal(el.querySelectorAll('script,img,[onerror]').length,0);assert.equal(el.querySelectorAll('a').length,1);assert.equal(el.querySelector('a').dataset.url,'https://example.org/paper');}finally{dom.window.close();}
});
