'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.cjs'),P=require('../src/providers.cjs');
const ok=data=>new Response(JSON.stringify(data),{status:200});
test('author pairs require equal counts and keep repeated institutions and author names',()=>{
 for(const input of [{name:'Ming Li'},{school:'University A'},{name:'Ming Li; Alice Chen',school:'University A'}])assert.throws(()=>C.authorPairs(input),/INVALID_AUTHOR_SEARCH/);
 assert.deepEqual(C.authorPairs({}),[]);
 const s=C.validateSettings({...C.defaults().settings,authorName:'Ming Li; Alice Chen',authorSchool:'University A; University A'});
 assert.equal(s.authorSchool,'University A; University A');assert.equal(C.authorPairs({name:s.authorName,school:s.authorSchool}).length,2);
 assert.deepEqual(C.authorPairs({name:'Ming Li; Ming Li',school:'University A; University B'}).map(p=>p.school),['University A','University B']);
 assert.throws(()=>C.authorPairs({name:Array(11).fill('Author').join(';'),school:Array(11).fill('Institution').join(';')}),/AUTHOR_LIST_LIMIT/);
});
test('manual and weekly settings reject incomplete author searches independently',()=>{
 const s=C.defaults().settings;s.groups=[['laser'],[],[]];s.authorName='Ming Li';assert.throws(()=>C.searchSettings(s),/INVALID_AUTHOR_SEARCH/);
 s.authorSchool='University A';s.weekly.authorName='Alice Chen';assert.throws(()=>C.searchSettings(s,true),/INVALID_AUTHOR_SEARCH/);
 s.weekly.authorSchool='University B';assert.equal(C.searchSettings(s).authorSchool,'University A');assert.equal(C.searchSettings(s,true).authorSchool,'University B');
});
function paper(name='Ming Li',affiliations=['University A']){return C.normalizePaper({title:'Strict match',authors:[{name,first:true}],authorDetails:[{name,id:'https://openalex.org/A1',affiliations}]});}
test('strict author matching rejects partial names, partial institutions, missing evidence and ID bypasses',()=>{
 const q={name:'Ming Li',school:'University A',role:'first'};
 assert(P.matchesAuthor(paper(),q));assert(P.matchesAuthor(paper('  MING   LI ',['Ｕｎｉｖｅｒｓｉｔｙ A']),q));
 for(const p of [paper('Ming Liang'),paper('MingLi'),paper('M. Li'),paper('Ming Li',['University A Medical Center']),paper('Ming Li',[])])assert(!P.matchesAuthor(p,q,['https://openalex.org/A1']));
 assert.throws(()=>P.matchesAuthor(paper(),{name:'Ming Li'}),/INVALID_AUTHOR_SEARCH/);
});
test('author/institution pairs never cross-match another author or another pair',()=>{
 const p=C.normalizePaper({title:'Wrong affiliations',authors:[{name:'Ming Li',first:true},{name:'Alice Chen',corresponding:true}],authorDetails:[{name:'Ming Li',affiliations:['University B']},{name:'Alice Chen',affiliations:['University A']}]}),query={name:'Ming Li; Alice Chen',school:'University A; University B',role:'either'};
 assert(!P.matchesAuthor(p,query));assert(!P.matchesAuthor(p,{name:'Ming Li',school:'University A',role:'first'}));
 assert(P.matchesAuthor(p,{...query,school:'University B; University A'}));
 assert(!P.matchesAuthor(p,{name:'Ming Li',school:'University B',role:'corresponding'}));
});
test('identically named coauthors with different IDs cannot lend each other a role or affiliation',()=>{
 const p=P.fromOpenAlex({display_name:'Namesakes',authorships:[{author:{id:'https://openalex.org/A1',display_name:'Ming Li'},author_position:'first',institutions:[{display_name:'University A'}]},{author:{id:'https://openalex.org/A2',display_name:'Ming Li'},author_position:'middle',institutions:[{display_name:'University B'}]}]});
 assert(!P.matchesAuthor(p,{name:'Ming Li',school:'University B',role:'first'}));assert(P.matchesAuthor(p,{name:'Ming Li',school:'University A',role:'first'}));
 assert.equal(C.mergeAuthorDetails([{name:'Ming Li',affiliations:['University A']}],[{name:'MingLi',affiliations:['University B']}]).length,2);
});
test('OpenAlex profile affiliation and author ID cannot admit a work without the same work affiliation',async()=>{
 const accepted=[],q={name:'Ming Li',school:'University A',role:'first'};
 const stats=await P.searchAuthors({groups:[],journals:[],maxPages:1},'test-only',q,{onProgress:()=>{},onPaper:p=>accepted.push(p),fetcher:async raw=>{
  const u=new URL(raw);if(u.pathname==='/authors')return ok({results:[{id:'https://openalex.org/A1',display_name:'Ming Li',last_known_institutions:[{display_name:'University A'}]}]});
  return ok({meta:{count:4},results:[['Correct','University A','Ming Li'],['Missing',null,'Ming Li'],['Partial','University A Medical Center','Ming Li'],['Alias','University A','M. Li']].map(([title,institution,name])=>({display_name:title,authorships:[{author:{id:'https://openalex.org/A1',display_name:name},author_position:'first',institutions:institution?[{display_name:institution}]:[]}]}))});
 }});
 assert.deepEqual(accepted.map(p=>p.title),['Correct']);assert.equal(stats.rejected,3);assert.equal(stats.received,1);
});
test('Scholar fallback checks enriched affiliation instead of trusting the query text',async()=>{
 const accepted=[],q={name:'Ming Li',school:'University A',role:'first'};
 const stats=await P.searchAuthor({groups:[],journals:[],maxPages:1},'test-only',q,{onProgress:()=>{},onPaper:p=>accepted.push(p),fetcher:async raw=>{
  const u=new URL(raw);if(u.pathname==='/authors')return ok({results:[]});
  if(u.hostname==='serpapi.com'){assert(u.searchParams.get('q').includes('author:"Ming Li" "University A"'));return ok({organic_results:[{title:'Wrong',link:'https://doi.org/10.1000/wrong'}]});}
  if(u.hostname==='api.crossref.org')return ok({message:{DOI:'10.1000/wrong',abstract:'Full abstract',author:[{given:'Ming',family:'Li',affiliation:[{name:'University B'}]}]}});
  if(u.hostname==='api.openalex.org')return ok({doi:'https://doi.org/10.1000/wrong',authorships:[{author:{display_name:'Ming Li'},author_position:'first',institutions:[{display_name:'University B'}]}]});
  throw Error('Unexpected URL');
 }});assert.equal(accepted.length,0);assert.equal(stats.rejected,1);assert.equal(stats.received,0);
});
test('invalid author queries fail before making any network requests',async()=>{
 const options={onPaper:()=>assert.fail(),onProgress:()=>{},fetcher:()=>assert.fail('No request expected')};
 for(const q of [{name:'Ming Li',school:''},{name:'Ming Li; Alice Chen',school:'University A'}])await assert.rejects(P.searchAuthors({groups:[],journals:[],maxPages:1},'test-only',q,options),/INVALID_AUTHOR_SEARCH/);
});
test('all keyword groups fan out as a union, deduplicate repeated keywords and preserve phrases and groups',async()=>{
 const s={groups:[['dual comb','laser'],['LASER','spectroscopy'],[]],journals:['Nature','Science'],maxPages:1},queries=[],papers=[];
 const plan=C.queryPlan(s);assert.equal(plan.length,6);assert.deepEqual(plan.filter(p=>p.q.startsWith('"laser"')).map(p=>p.groups),[[0,1],[0,1]]);
 await P.searchScholar(s,'test-only',{onProgress:()=>{},onPaper:p=>papers.push(p),fetcher:async raw=>{const u=new URL(raw),q=u.searchParams.get('q');queries.push(q);return ok({organic_results:[{title:q.startsWith('"dual comb"')?'Comb only':q.startsWith('"laser"')?'Laser only':'Spectroscopy only'}]});}});
 assert(queries.includes('"dual comb" source:"Nature"'));assert(queries.includes('"spectroscopy" source:"Science"'));assert(!queries.some(q=>q.includes('"dual comb" "laser"')));
 const merged=[];for(const p of papers)C.upsert(merged,p);assert.equal(merged.length,3);assert.deepEqual(merged.find(p=>p.title==='Laser only').groups,[0,1]);
 const weekly=C.defaults().settings;weekly.weekly={...weekly.weekly,...s};assert.equal(C.queryPlan(C.searchSettings(weekly,true)).length,6);
});
