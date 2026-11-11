'use strict';
const {norm,clean,cleanAbstract,doiFrom,fromScholar,queryPlan,safeURL,normalizePaper,corresponding,peopleList,monthOnly,isTruncatedTitle,mergeAuthorDetails}=require('./core.cjs');
const F=require('./features.cjs');
const {publisherMetadata}=require('./publisher.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function requestJSON(url,signal,fetcher=fetch) {
  for(let attempt=0;attempt<3;attempt++) {
    signal?.throwIfAborted();
    const timeout=AbortSignal.timeout(25000);const active=signal?AbortSignal.any([signal,timeout]):timeout;
    let r;
    try {r=await fetcher(url,{signal:active,headers:{Accept:'application/json','User-Agent':'PaperDesk/1.0 (research desktop)'}});}
    catch(e){if(signal?.aborted)throw e;if(attempt===2)throw Error('NETWORK_ERROR');await sleep(800*(attempt+1));continue;}
    if(r.status===429 || r.status>=500){if(attempt<2){await sleep(Math.min(10000,Math.max(1000,Number(r.headers.get('retry-after')||1)*1000)));continue;}}
    if(!r.ok)throw Error('HTTP_'+r.status);
    try{return await r.json();}catch{throw Error('INVALID_RESPONSE');}
  }
}
async function searchScholar(settings,key,{signal,onPaper,onProgress,fetcher=fetch,plan:customPlan}) {
  if(!key)throw Error('SERPAPI_KEY_REQUIRED');
  const plan=customPlan||queryPlan(settings);if(!plan.length)throw Error('KEYWORDS_REQUIRED');
  const stats={queries:plan.length,pages:0,received:0,capped:[],finished:0};
  for(let qi=0;qi<plan.length;qi++) {
    const task=plan[qi];const seen=new Set();
    for(let page=0;page<settings.maxPages;page++) {
      signal?.throwIfAborted();
      onProgress({phase:'search',query:qi+1,total:plan.length,page:page+1,group:task.group,journal:task.journal});
      const url=new URL('https://serpapi.com/search.json');
      url.search=new URLSearchParams({engine:'google_scholar',q:task.q,hl:settings.language==='zh'?'zh-CN':'en',api_key:key,num:'20',start:String(page*20),as_vis:'1'}).toString();
      if(settings.yearFrom)url.searchParams.set('as_ylo',settings.yearFrom);if(settings.yearTo)url.searchParams.set('as_yhi',settings.yearTo);
      if(settings.publicationWindow)url.searchParams.set('scisbd','2');
      const data=await requestJSON(url,signal,fetcher);
      if(data.error)throw Error('SERPAPI_ERROR');
      if(!Array.isArray(data.organic_results) && data.search_information?.organic_results_state!=='Fully empty')throw Error('INVALID_RESPONSE');
      const results=data.organic_results||[];stats.pages++;let fresh=0;
      for(const r of results) {if(!r.title)continue;const p=fromScholar(r,task.group);if(seen.has(p.id))continue;seen.add(p.id);fresh++;stats.received++;await onPaper(p);}
      const more=!!(data.serpapi_pagination?.next||data.pagination?.next);
      if(!more||!results.length)break;
      if(!fresh){stats.capped.push({query:task.q,reason:'repeated_page'});break;}
      if(page===settings.maxPages-1)stats.capped.push({query:task.q,reason:'page_limit'});
      await sleep(350);
    }
    stats.finished++;
  }
  return stats;
}
function reconstructAbstract(index) {if(!index||typeof index!=='object')return '';const words=[];for(const [word,positions]of Object.entries(index)){if(!Array.isArray(positions))continue;for(const n of positions)if(Number.isInteger(n)&&n>=0&&n<20000)words[n]=word;}return words.join(' ');}
async function enrichPaper(input,signal,fetcher=fetch) {
  const p=structuredClone(input);let cr=null;const failures=[];
  try {
    if(p.doi)cr=(await requestJSON('https://api.crossref.org/works/'+encodeURIComponent(p.doi),signal,fetcher)).message;
    else {
      const u=new URL('https://api.crossref.org/works');u.search=new URLSearchParams({'query.title':p.title,rows:'3'});
      const items=(await requestJSON(u,signal,fetcher)).message?.items||[];
      // A title guess must not silently attach metadata from another article.
      const exact=items.filter(x=>norm(x.title?.[0])===norm(p.title));
      if(exact.length===1)cr=exact[0];
    }
    if(cr) {
      if(p.doi&&doiFrom(cr.DOI)!==p.doi)throw Error('DOI_MISMATCH');
      if(isTruncatedTitle(p.title)&&cr.title?.[0]&&!isTruncatedTitle(cr.title[0]))p.title=clean(cr.title[0]);
      p.doi=doiFrom(cr.DOI);p.abstract=cleanAbstract(cr.abstract)||p.abstract;p.journal=clean(cr['container-title']?.[0])||p.journal;
      p.year=String(cr.published?.['date-parts']?.[0]?.[0]||p.year);
      p.publicationDate=F.fromParts(cr['published-online']?.['date-parts']?.[0])||F.fromParts(cr.published?.['date-parts']?.[0])||F.fromParts(cr.issued?.['date-parts']?.[0])||p.publicationDate||'';
      const parts=[cr['published-online'],cr.published,cr.issued].map(d=>d?.['date-parts']?.[0]).find(d=>d?.length>=2);p.publicationMonth=monthOnly(p.publicationDate)|| (parts?monthOnly(parts[0]+'-'+String(parts[1]).padStart(2,'0')):'')||p.publicationMonth||'';
      if(cr.author?.length){p.authors=cr.author.map((a,i)=>({name:clean([a.given,a.family].filter(Boolean).join(' ')||a.name),first:i===0,corresponding:a.corresponding===true,evidence:'Crossref author order'}));p.authorDetails=mergeAuthorDetails(p.authorDetails,cr.author.map(a=>({name:clean([a.given,a.family].filter(Boolean).join(' ')||a.name),affiliations:(a.affiliation||[]).map(x=>clean(x.name))})));}
      if(!p.url&&cr.URL)p.url=safeURL(cr.URL);p.sources=[...new Set([...p.sources,'Crossref'])];
    }
  }catch(e){if(signal?.aborted)throw e;failures.push('Crossref: '+e.message);}
  if(p.doi) {
    try {
      const url=new URL('https://api.openalex.org/works/https://doi.org/'+p.doi);
      const w=await requestJSON(url,signal,fetcher);
      if(doiFrom(w.doi)!==p.doi)throw Error('DOI_MISMATCH');
      if(isTruncatedTitle(p.title)&&w.display_name&&!isTruncatedTitle(w.display_name))p.title=clean(w.display_name);
      p.abstract=p.abstract||reconstructAbstract(w.abstract_inverted_index);
      p.journal=p.journal||w.primary_location?.source?.display_name||'';
      p.year=p.year||String(w.publication_year||'');
      p.publicationDate=p.publicationDate||F.dateOnly(w.publication_date);
      p.pdf=p.pdf||safeURL(w.best_oa_location?.pdf_url);
      if(w.authorships?.length){p.authors=w.authorships.map((a,i)=>({name:a.author?.display_name||a.raw_author_name||'',first:a.author_position?a.author_position==='first':i===0,corresponding:a.is_corresponding===true,evidence:'OpenAlex is_corresponding'}));p.authorDetails=mergeAuthorDetails(p.authorDetails,w.authorships.map(a=>({name:a.author?.display_name||a.raw_author_name||'',id:a.author?.id,affiliations:[...(a.institutions||[]).map(i=>i.display_name),...(a.raw_affiliation_strings||[])]})));}
      // OpenAlex keywords are machine-indexed topics, not publisher author keywords.
      p.topics=(w.keywords||[]).map(k=>k.display_name);p.sources=[...new Set([...p.sources,'OpenAlex'])];
    }catch(e){if(signal?.aborted)throw e;failures.push('OpenAlex: '+e.message);}
  }
  if((!p.journal||!p.year||!p.abstract||!corresponding(p).length)&&p.url){
    try{
      const active=signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000);
      const response=await fetcher(p.url,{signal:active,headers:{Accept:'text/html','User-Agent':'PaperDesk/1.2'}});
      if(response.ok&&(!response.headers.get('content-type')||/html|xml/i.test(response.headers.get('content-type')))){
        const declared=Number(response.headers.get('content-length')||0);if(declared>3000000)throw Error('PAGE_TOO_LARGE');
        const reader=response.body?.getReader();let html='';
        if(reader){const decoder=new TextDecoder();let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000)throw Error('PAGE_TOO_LARGE');html+=decoder.decode(value,{stream:true});}html+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}}else html=await response.text();
        const meta=publisherMetadata(html,p);if(meta){if(isTruncatedTitle(p.title)&&meta.title&&!isTruncatedTitle(meta.title))p.title=meta.title;p.abstract=p.abstract||meta.abstract;p.journal=p.journal||meta.journal;p.year=p.year||meta.year;p.publicationDate=p.publicationDate||meta.publicationDate;
          if(meta.authors.length){for(const a of meta.authors){const old=p.authors.find(x=>norm(x.name)===norm(a.name));if(old)a.corresponding ||= old.corresponding;}p.authors=meta.authors;}
          if(meta.authorDetails.length)p.authorDetails=mergeAuthorDetails(p.authorDetails,meta.authorDetails);if(meta.keywords.length)p.keywords=meta.keywords;p.sources=[...new Set([...p.sources,'Publisher'])];}
      }
    }catch(e){if(signal?.aborted)throw e;failures.push('Publisher: '+(e.name==='TimeoutError'?'TIMEOUT':'UNAVAILABLE'));}
  }
  if(!p.abstract&&p.doi){
    try{
      const w=await requestJSON('https://api.semanticscholar.org/graph/v1/paper/DOI:'+encodeURIComponent(p.doi)+'?fields=title,abstract,externalIds',signal,fetcher);
      if(doiFrom(w.externalIds?.DOI)===p.doi&&w.abstract){p.abstract=clean(w.abstract);p.sources=[...new Set([...p.sources,'Semantic Scholar'])];}
    }catch(e){if(signal?.aborted)throw e;failures.push('Abstract: '+e.message);}
  }
  p.publicationMonth=monthOnly(p.publicationDate)||p.publicationMonth||'';p.abstract=cleanAbstract(p.abstract);p.metadataStatus=failures.length?'partial':(p.doi?'checked':'unmatched');p.metadataNote=failures.join('; ');return p;
}
function matchesAuthor(p,{name,school,role='either'},ids=[]){
  const schools=peopleList(school,200);
  return p.authors.some(a=>{const detail=(p.authorDetails||[]).find(d=>norm(d.name)===norm(a.name));const identity=detail?.id&&ids.includes(detail.id);
    return (identity||norm(a.name)===norm(name))&&(!schools.length||identity||detail?.affiliations?.some(s=>schools.some(school=>norm(s).includes(norm(school)))))&&(role==='first'?a.first:role==='corresponding'?a.corresponding:(a.first||a.corresponding));});
}
function fromOpenAlex(w){
  return normalizePaper({title:w.display_name||w.title,doi:w.doi,url:w.primary_location?.landing_page_url||w.doi,year:w.publication_year,publicationDate:F.dateOnly(w.publication_date),journal:w.primary_location?.source?.display_name,abstract:reconstructAbstract(w.abstract_inverted_index),pdf:w.best_oa_location?.pdf_url,
    authors:(w.authorships||[]).map((a,i)=>({name:a.author?.display_name||a.raw_author_name,first:a.author_position?a.author_position==='first':i===0,corresponding:a.is_corresponding===true,evidence:'OpenAlex authorship'})),
    authorDetails:(w.authorships||[]).map(a=>({name:a.author?.display_name||a.raw_author_name,id:a.author?.id,affiliations:[...(a.institutions||[]).map(x=>x.display_name),...(a.raw_affiliation_strings||[])]})),sources:['OpenAlex'],metadataStatus:'checked'});
}
async function searchAuthor(settings,key,query,{signal,onPaper,onProgress,fetcher=fetch}){
  let authors=[];const schools=peopleList(query.school,200);
  try{const url=new URL('https://api.openalex.org/authors');url.search=new URLSearchParams({search:query.name,'per-page':'25'});const data=await requestJSON(url,signal,fetcher);
    const candidates=(data.results||[]).filter(a=>[a.display_name,...(a.display_name_alternatives||[])].some(n=>norm(n)===norm(query.name)));
    const institutions=a=>[...(a.last_known_institutions||[]),...(a.affiliations||[]).map(x=>x.institution)];
    const authorIds=new Set();
    if(!schools.length)authors=candidates;else for(const school of schools){
      let matches=candidates.filter(a=>institutions(a).some(i=>norm(i?.display_name).includes(norm(school))));
      if(!matches.length&&candidates.length){const lookup=new URL('https://api.openalex.org/institutions');lookup.search=new URLSearchParams({search:school,'per-page':'10'});const found=(await requestJSON(lookup,signal,fetcher)).results||[];
        const ids=found.filter(i=>[i.display_name,...(i.display_name_alternatives||[]),...(i.display_name_acronyms||[])].some(n=>norm(n)===norm(school))).map(i=>i.id);matches=candidates.filter(a=>institutions(a).some(i=>ids.includes(i?.id)));}
      for(const match of matches)if(!authorIds.has(match.id)){authorIds.add(match.id);authors.push(match);}
    }
  }catch(e){if(signal?.aborted)throw e;}
  let rejected=0;
  if(authors.length){
    const ids=authors.map(a=>a.id);const stats={queries:1,pages:0,received:0,capped:[],finished:0,rejected:0};
    for(let page=1;page<=settings.maxPages;page++){
      onProgress({phase:'search',query:1,total:1,page});const url=new URL('https://api.openalex.org/works');url.search=new URLSearchParams({filter:'authorships.author.id:'+ids.map(id=>id.split('/').at(-1)).join('|'),'per-page':'50',page:String(page),sort:'publication_date:desc'});
      if(!settings.publicationWindow){const bounds=F.monthBounds(settings);let filter=url.searchParams.get('filter');if(bounds.start)filter+=',from_publication_date:'+bounds.start;if(bounds.end)filter+=',to_publication_date:'+bounds.end;url.searchParams.set('filter',filter);}
      if(settings.publicationWindow){const last=new Date(settings.publicationWindow.end+'T12:00:00');last.setDate(last.getDate()-1);url.searchParams.set('filter',url.searchParams.get('filter')+',from_publication_date:'+settings.publicationWindow.start+',to_publication_date:'+F.localDate(last));}
      const data=await requestJSON(url,signal,fetcher);if(!Array.isArray(data.results))throw Error('INVALID_RESPONSE');stats.pages++;
      for(const work of data.results){const p=fromOpenAlex(work);if(settings.journals.length&&!settings.journals.some(j=>norm(j)===norm(p.journal)))continue;if(matchesAuthor(p,query,ids)){p.authorSearches=[query];await onPaper(p);stats.received++;}else rejected++;}
      if(page*50>=(data.meta?.count||0)||!data.results.length)break;if(page===settings.maxPages)stats.capped.push({reason:'page_limit'});
    }stats.finished=1;stats.rejected=rejected;return stats;
  }
  if(!key)throw Error('SERPAPI_KEY_REQUIRED');
  const quote=s=>'"'+s.replace(/["\\]/g,' ').trim()+'"';
  const base=queryPlan({...settings,authorName:''});const journals=settings.journals.length?settings.journals:[''];const plan=(base.length?base:journals.map(j=>({group:0,journal:j,q:j?'source:'+quote(j):''}))).map(p=>({...p,q:'author:'+quote(query.name)+(schools.length?' ('+schools.map(quote).join(' OR ')+')':'')+' '+p.q}));
  const stats=await searchScholar(settings,key,{signal,fetcher,plan,onProgress,onPaper:async raw=>{const p=await enrichPaper(raw,signal,fetcher);if(matchesAuthor(p,query)){p.authorSearches=[query];await onPaper(p);}else rejected++;}});
  stats.rejected=rejected;return stats;
}
async function testSerpapi(key,{fetcher=fetch}={}){
  if(!key)throw Error('SERPAPI_KEY_REQUIRED');let response;
  try{const url=new URL('https://serpapi.com/account.json');url.searchParams.set('api_key',key);response=await fetcher(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});}catch{throw Error('NETWORK_ERROR');}
  if(!response.ok)throw Error(response.status===401||response.status===403?'SERPAPI_AUTH':'HTTP_'+response.status);
  let account;try{account=await response.json();}catch{throw Error('INVALID_RESPONSE');}
  if(account.error)throw Error('SERPAPI_AUTH');if(typeof account.account_id!=='string'||!Number.isFinite(Number(account.total_searches_left)))throw Error('INVALID_RESPONSE');
  return {remaining:Number(account.total_searches_left)};
}
async function searchAuthors(settings,key,query,options){const names=peopleList(query.name),seen=new Set(),combined={queries:0,pages:0,received:0,capped:[],finished:0,rejected:0};if(!names.length)throw Error('INVALID_AUTHOR_SEARCH');for(let i=0;i<names.length;i++){options.signal?.throwIfAborted();const stats=await searchAuthor(settings,key,{...query,name:names[i]},{...options,onProgress:p=>options.onProgress({...p,query:i+1,total:names.length}),onPaper:async p=>{const identity=p.doi||p.id;if(seen.has(identity))return;seen.add(identity);p.authorSearches=[query];await options.onPaper(p);}});for(const k of ['queries','pages','received','finished','rejected'])combined[k]+=stats[k]||0;combined.capped.push(...stats.capped);}return combined;}
module.exports={requestJSON,searchScholar,enrichPaper,reconstructAbstract,matchesAuthor,fromOpenAlex,searchAuthor,searchAuthors,testSerpapi};
