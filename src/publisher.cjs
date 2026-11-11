'use strict';
const {norm,clean,cleanAbstract,doiFrom,safeURL,isTruncatedTitle}=require('./core.cjs');
const decode=s=>String(s||'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):'';}).replace(/&(?:nbsp|amp|quot|apos|lt|gt);/g,x=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[x]));
// Read declared metadata only; no page scripts are executed or authors inferred.
function publisherMetadata(html,paper){
 if(typeof html!=='string'||html.length>3000000)return null;
 const entries=[];
 for(const tag of html.match(/<meta\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)||[]){const a={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))a[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);const key=(a.name||a.property||'').toLowerCase();if(key)entries.push([key,a.content||'']);}
 const get=n=>entries.filter(([k])=>k===n).map(([,v])=>v);
 const doi=doiFrom(get('citation_doi')[0]||get('dc.identifier')[0]);const title=get('citation_title')[0]||get('dc.title')[0];
 const samePage=(a,b)=>{try{const x=new URL(safeURL(a)),y=new URL(safeURL(b));return x.hostname===y.hostname&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'');}catch{return false;}};
 const canonical=get('citation_public_url')[0]||get('og:url')[0];const fragments=String(paper.title||'').split(/…|\.{3}/).map(norm).filter(Boolean);let offset=0;const complete=norm(title);const matchesFragments=fragments.length&&fragments.join('').length>=16&&fragments.every(fragment=>{const at=complete.indexOf(fragment,offset);if(at<0)return false;offset=at+fragment.length;return true;});
 const verifiedTruncation=isTruncatedTitle(paper.title)&&!isTruncatedTitle(title)&&samePage(canonical,paper.url)&&matchesFragments;
 if(paper.doi&&doi?paper.doi!==doi:!verifiedTruncation&&norm(title)!==norm(paper.title))return null;
 const authors=[],authorDetails=[];let current=-1;
 for(const [key,value]of entries){if(key==='citation_author'){current=authors.length;authors.push({name:clean(value),first:current===0,corresponding:false,evidence:'Publisher citation metadata'});authorDetails.push({name:clean(value),affiliations:[]});}
  if(current>=0&&['citation_author_institution','citation_author_affiliation'].includes(key))authorDetails[current].affiliations.push(clean(value));
  if(current>=0&&key==='citation_author_is_corresponding')authors[current].corresponding=/^(true|1|yes)$/i.test(value);
 }
 for(const name of get('citation_corresponding_author')){const a=authors.find(a=>norm(a.name)===norm(name));if(a)a.corresponding=true;}
 const date=(get('citation_online_date')[0]||get('citation_publication_date')[0]||get('citation_date')[0]||'').replaceAll('/','-');
 return {doi,title:clean(title),abstract:cleanAbstract(decode(get('citation_abstract')[0]||get('dc.description')[0])),journal:clean(get('citation_journal_title')[0]),year:date.match(/\b(?:19|20)\d{2}\b/)?.[0]||'',publicationDate:require('./features.cjs').dateOnly(date),authors,authorDetails,keywords:get('citation_keywords').concat(get('keywords')).flatMap(s=>s.split(/[;,；，]/)).map(clean).filter(Boolean)};
}
module.exports={publisherMetadata};
