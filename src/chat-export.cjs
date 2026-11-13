'use strict';
const fs=require('node:fs'),path=require('node:path');
function select(chats,input={}){
 if(!['questions-md','answers-md','answers-pdf'].includes(input.format)||!['current','all'].includes(input.scope))throw Error('INVALID_FORMAT');
 const chosen=chats.filter(c=>(input.scope==='all'||c.id===input.id)&&c.messages.some(m=>m.role==='user'));
 if(!chosen.length)throw Error('CHAT_EXPORT_EMPTY');
 return structuredClone(chosen);
}
const line=s=>String(s||'').replace(/\s+/g,' ').trim();
const heading=s=>line(s).replace(/[\\`*_{}\[\]<>#]/g,'\\$&');
function turns(chat){const result=[];for(const m of chat.messages){if(m.role==='user')result.push({question:m.content,answers:[]});else if(m.role==='assistant'&&result.length)result.at(-1).answers.push(m);}return result;}
function markdown(chats,{questionsOnly=false,language='zh'}={}){
 const zh=language==='zh',out=['# PaperDesk · '+(zh?'研究问题':'Research questions'),''];
 for(const c of chats){out.push('## '+heading(c.title),'');for(const [i,t]of turns(c).entries()){
  out.push('### '+(zh?'问题 ':'Question ')+(i+1),'',t.question,'');
  if(!questionsOnly){out.push('#### '+(zh?'回答':'Answer'),'');for(const a of t.answers)out.push(a.status==='complete'?a.content:zh?'[回答未完成]':'[Answer incomplete]','');if(!t.answers.length)out.push(zh?'[暂无回答]':'[No answer]','');}
 }}return out.join('\n');
}
async function pdf(BrowserWindow,chats,language){
 const window=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 try{window.webContents.setWindowOpenHandler(()=>({action:'deny'}));await window.loadFile(path.join(__dirname,'chat-print.html'));
  await window.webContents.executeJavaScript('window.renderChatExport('+JSON.stringify({chats:chats.map(c=>({title:c.title,turns:turns(c)})),language})+')');
  return await window.webContents.printToPDF({pageSize:'A4',printBackground:true,generateTaggedPDF:true,generateDocumentOutline:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;text-align:center;font-size:9px;color:#666"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',margins:{top:.6,bottom:.65,left:.6,right:.6}});
 }finally{window.destroy();}
}
async function exportChat({BrowserWindow,dialog,win,chats,input,language}){
 const chosen=select(chats,input),extension=input.format==='answers-pdf'?'pdf':'md';
 const picked=await dialog.showSaveDialog(win,{defaultPath:'PaperDesk-'+(input.scope==='all'?'All-Questions':line(chosen[0].title).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,70))+'.'+extension,filters:[{name:extension.toUpperCase(),extensions:[extension]}]});
 if(picked.canceled)return false;
 const content=extension==='pdf'?await pdf(BrowserWindow,chosen,language):markdown(chosen,{questionsOnly:input.format==='questions-md',language});
 fs.writeFileSync(picked.filePath,content);return true;
}
module.exports={select,turns,markdown,pdf,exportChat};
