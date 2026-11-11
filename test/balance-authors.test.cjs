'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../src/core.cjs'),F=require('../src/features.cjs'),P=require('../src/providers.cjs'),AI=require('../src/ai.cjs');
const ok=data=>new Response(JSON.stringify(data),{status:200});
test('DeepSeek balance uses a read-only request and returns only currency totals',async()=>{
 const result=await AI.balance('sample',{fetcher:async(url,options)=>{assert.equal(url,'https://api.deepseek.com/user/balance');assert.equal(options.headers.Authorization,'Bearer sample');assert(!options.body);return ok({is_available:true,balance_infos:[{currency:'CNY',total_balance:'12.340',granted_balance:'2',topped_up_balance:'10.340'}],api_key:'do-not-return',email:'private'});}});
 assert.deepEqual(result,{available:true,balances:[{currency:'CNY',total:'12.340'}]});
});
test('balance failures never expose a provider body or manufacture a remaining quota',async()=>{
 await assert.rejects(AI.balance('bad',{fetcher:async()=>new Response('private bad-key',{status:401})}),/^Error: DEEPSEEK_AUTH$/);
 await assert.rejects(AI.balance('sample',{fetcher:async()=>ok({is_available:true,balance_infos:[{currency:'CNY',total_balance:'unknown'}]})}),/INVALID_RESPONSE/);
 const zero=await AI.balance('sample',{fetcher:async()=>ok({is_available:false,balance_infos:[{currency:'USD',total_balance:'0.00'}]})});assert.equal(zero.available,false);assert.equal(zero.balances[0].total,'0.00');
});
test('multiple author/institution inputs preserve names with commas and reject excessive fan-out',()=>{
 assert.deepEqual(C.peopleList('Li, Ming; Alice Chen\nLi, Ming'),['Li, Ming','Alice Chen']);const s=C.validateSettings({...C.defaults().settings,authorName:'Ming Li\nAlice Chen',authorSchool:'University A; University B'});assert.equal(s.authorName,'Ming Li; Alice Chen');assert.equal(s.authorSchool,'University A; University B');assert.throws(()=>C.peopleList(Array.from({length:11},(_,i)=>'Author '+i).join(';')),/AUTHOR_LIST_LIMIT/);
});
test('multiple institutions match the same confirmed author, not a different coauthor',()=>{
 const p=C.normalizePaper({title:'A',authors:[{name:'Ming Li',corresponding:true},{name:'Alice Chen',first:true}],authorDetails:[{name:'Ming Li',affiliations:['University B']},{name:'Alice Chen',affiliations:['University A']}]});
 assert(P.matchesAuthor(p,{name:'Ming Li',school:'University A; University B',role:'corresponding'}));assert(!P.matchesAuthor(p,{name:'Ming Li',school:'University A; University C',role:'corresponding'}));
});
test('multi-author results are unioned once with the original batch association',async()=>{
 const papers=[],query={name:'Ming Li; Alice Chen',school:'University A; University B',role:'either'};
 await P.searchAuthors({groups:[],journals:[],maxPages:1},'sample',query,{onProgress:()=>{},onPaper:p=>papers.push(p),fetcher:async raw=>{const url=new URL(raw);if(url.pathname==='/authors'){const name=url.searchParams.get('search');return ok({results:[{id:'https://openalex.org/'+(name==='Ming Li'?'A1':'A2'),display_name:name,last_known_institutions:[{display_name:'University B'}]}]});}return ok({meta:{count:1},results:[{display_name:'Shared paper',doi:'https://doi.org/10.1000/shared',authorships:[{author:{id:'https://openalex.org/A1',display_name:'Ming Li'},author_position:'last',is_corresponding:true},{author:{id:'https://openalex.org/A2',display_name:'Alice Chen'},author_position:'first'}]}]});}});
 assert.equal(papers.length,1);assert.deepEqual(papers[0].authorSearches,[query]);
});
test('month ranges include both boundary months, reject unknown months and handle leap years',()=>{
 const s=C.validateSettings({...C.defaults().settings,monthFrom:'2024-02',monthTo:'2024-03'});assert.equal(s.yearFrom,2024);assert.deepEqual(F.monthBounds({...s,monthTo:'2024-02'}),{start:'2024-02-01',end:'2024-02-29'});
 for(const m of ['2024-02','2024-03'])assert(F.inPublicationRange({publicationMonth:m},s));for(const m of ['2024-01','2024-04',''])assert(!F.inPublicationRange({publicationMonth:m,year:'2024'},s));assert.throws(()=>C.validateSettings({...s,monthFrom:'2024-04',monthTo:'2024-03'}),/INVALID_MONTH_RANGE/);assert.equal(C.searchSettings({...s,weekly:s},true).monthFrom,'');
});
test('Crossref month-only publication data is retained without inventing a day',async()=>{
 const p=await P.enrichPaper(C.normalizePaper({title:'Month only',doi:'10.1000/month',abstract:'Full abstract',authors:[{name:'Ming',corresponding:true}]}),undefined,async raw=>{const url=new URL(raw);if(url.hostname==='api.crossref.org')return ok({message:{DOI:'10.1000/month',published:{'date-parts':[[2024,2]]}}});throw Error('Unavailable');});assert.equal(p.publicationMonth,'2024-02');assert.equal(p.publicationDate,'');assert(F.inPublicationRange(p,{monthFrom:'2024-02',monthTo:'2024-02'}));assert(!F.publicationInWindow(p,{start:'2024-02-01',end:'2024-03-01'}));
});
test('deleting one question removes its answer while preserving other turns and custom names',()=>{
 const data={chats:[{id:'chat',title:'Custom name',messages:[{id:'q1',role:'user',content:'First'},{id:'a1',role:'assistant',content:'Answer 1'},{id:'q2',role:'user',content:'Second'},{id:'a2',role:'assistant',content:'Answer 2'}]}]};C.removeChat(data,{id:'chat',messageId:'q1'});assert.deepEqual(data.chats[0].messages.map(m=>m.id),['q2','a2']);assert.equal(data.chats[0].title,'Custom name');C.removeChat(data,{id:'chat'});assert.equal(data.chats.length,0);
});
test('legacy year limits migrate to complete year/month ranges without changing the stored API keys',()=>{const base=path.resolve(__dirname,'../tmp'),dir=fs.mkdtempSync(path.join(base,'v140-migration-'));try{const store=new C.Store(dir);delete store.data.settings.monthFrom;delete store.data.settings.monthTo;store.data.settings.yearFrom=2020;store.data.settings.yearTo=2025;store.data.secrets.deepseek='encrypted';store.save();const restored=new C.Store(dir);assert.equal(restored.data.settings.monthFrom,'2020-01');assert.equal(restored.data.settings.monthTo,'2025-12');assert.equal(restored.data.secrets.deepseek,'encrypted');}finally{assert(dir.startsWith(base+path.sep));fs.rmSync(dir,{recursive:true,force:true});}});
