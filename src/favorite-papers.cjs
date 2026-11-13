'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MAX_PDF=100*1024*1024;
function validatePDF(bytes){if(!bytes.length||bytes.length>MAX_PDF||!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('INVALID_LOCAL_PDF');return bytes;}
function metadata(raw){
 if(!raw||!/^[a-f0-9]{64}$/.test(raw.id)||typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>300||!['','topic','writing'].includes(raw.tag))throw Error('INVALID_FAVORITE');
 return {id:raw.id,title:raw.title.trim(),tag:raw.tag,important:!!raw.important,addedAt:Number(raw.addedAt)||Date.now(),highlights:(raw.highlights||[]).slice(0,10000).map(highlight)};
}
function highlight(raw){
 if(!raw||!Number.isInteger(raw.page)||raw.page<1||raw.page>100000||!['yellow','green','pink'].includes(raw.color)||!Array.isArray(raw.rects)||!raw.rects.length||raw.rects.length>500)throw Error('INVALID_HIGHLIGHT');
 const rects=raw.rects.map(r=>{if(!r||['x','y','w','h'].some(k=>!Number.isFinite(r[k]))||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>1.001||r.y+r.h>1.001)throw Error('INVALID_HIGHLIGHT');return {x:r.x,y:r.y,w:r.w,h:r.h};});
 return {id:typeof raw.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(raw.id)?raw.id:crypto.randomUUID(),page:raw.page,color:raw.color,quote:String(raw.quote||'').slice(0,4000),rects,createdAt:Number(raw.createdAt)||Date.now()};
}
class Favorites{
 constructor(store){this.store=store;this.directory=path.join(path.dirname(store.file),'favorite-pdfs');fs.mkdirSync(this.directory,{recursive:true});store.data.favoritePapers||=[];}
 file(id){if(!/^[a-f0-9]{64}$/.test(id))throw Error('INVALID_FAVORITE');return path.join(this.directory,id+'.pdf');}
 get(id){const paper=this.store.data.favoritePapers.find(p=>p.id===id);if(!paper)throw Error('NOT_FOUND');return paper;}
 add(filename){if(path.extname(filename).toLowerCase()!=='.pdf'||fs.statSync(filename).size>MAX_PDF)throw Error('INVALID_LOCAL_PDF');return this.addBytes(fs.readFileSync(filename),{title:path.basename(filename,'.pdf'),tag:''});}
 addBytes(bytes,details){validatePDF(bytes);const id=crypto.createHash('sha256').update(bytes).digest('hex'),old=this.store.data.favoritePapers.find(p=>p.id===id);if(old)return {paper:old,added:false};
  const paper=metadata({...details,id,highlights:details.highlights||[]});fs.writeFileSync(this.file(id),bytes);this.store.data.favoritePapers.unshift(paper);this.store.save();return {paper,added:true};}
 read(id){this.get(id);const file=this.file(id);if(!fs.existsSync(file))throw Error('FAVORITE_PDF_MISSING');if(fs.statSync(file).size>MAX_PDF)throw Error('INVALID_LOCAL_PDF');return validatePDF(fs.readFileSync(file));}
 update(input){const paper=this.get(input.id);const next=metadata({...paper,...Object.fromEntries(['title','tag','important'].filter(k=>input[k]!==undefined).map(k=>[k,input[k]]))});Object.assign(paper,next);this.store.save();return paper;}
 annotate(input){const paper=this.get(input.id);if(input.remove){if(typeof input.remove!=='string')throw Error('INVALID_HIGHLIGHT');paper.highlights=paper.highlights.filter(h=>h.id!==input.remove);}else{if(paper.highlights.length>=10000)throw Error('HIGHLIGHT_LIMIT');paper.highlights.push(highlight(input.highlight));}this.store.save();return paper;}
 remove({id,confirm}){if(confirm!==true)throw Error('DELETE_CONFIRM_REQUIRED');this.get(id);this.store.data.favoritePapers=this.store.data.favoritePapers.filter(p=>p.id!==id);this.store.save();fs.rmSync(this.file(id),{force:true});}
 backup(){return this.store.data.favoritePapers.map(p=>({...p,pdfBase64:this.read(p.id).toString('base64')}));}
 restore(records){if(!Array.isArray(records)||records.length>5000)throw Error('INVALID_BACKUP');const prepared=records.map(r=>{const paper=metadata(r);if(typeof r.pdfBase64!=='string'||r.pdfBase64.length>Math.ceil(MAX_PDF*4/3)+4)throw Error('INVALID_BACKUP');const bytes=validatePDF(Buffer.from(r.pdfBase64,'base64'));if(crypto.createHash('sha256').update(bytes).digest('hex')!==paper.id)throw Error('INVALID_BACKUP');return {paper,bytes};});for(const {paper,bytes}of prepared)this.addBytes(bytes,paper);}
 clear(){for(const f of fs.readdirSync(this.directory))if(/^[a-f0-9]{64}\.pdf$/.test(f))fs.unlinkSync(path.join(this.directory,f));}
}
module.exports={Favorites,metadata,highlight,validatePDF,MAX_PDF};
