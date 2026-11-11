'use strict';
const fs=require('node:fs'),path=require('node:path'),F=require('./features.cjs');
async function exportWeekly({papers,runs,selection,directory,useAI=false,summarize,onProgress=()=>{},signal}){
 const chosen=F.selectWeekly(papers,runs,selection);if(!chosen.length)throw Error('EXPORT_SELECTION_REQUIRED');
 if(useAI&&typeof summarize!=='function')throw Error('DEEPSEEK_KEY_REQUIRED');
 // Complete AI work before creating output files, so cancellation or a provider
 // error cannot leave an apparently successful, incomplete batch behind.
 const groups=F.weeklyGroups(chosen,runs),prepared=[],files=[];
 for(let i=0;i<groups.length;i++){signal?.throwIfAborted();const {week,papers}=groups[i];onProgress({current:i+1,total:groups.length,week});let summary='';
  if(useAI){const parts=[];for(let at=0;at<papers.length;at+=12){signal?.throwIfAborted();parts.push(await summarize(F.summaryMessages(papers.slice(at,at+12),at),signal));}summary=parts.join('\n\n');}
  const file='weekly-'+week+'.md';prepared.push({name:file,content:F.reportMarkdown(week,papers,summary)});files.push({name:file,week,count:papers.length});
 }
 signal?.throwIfAborted();const destination=fs.mkdtempSync(path.join(directory,'PaperDesk-weekly-'));
 for(const file of prepared)fs.writeFileSync(path.join(destination,file.name),file.content,'utf8');
 const index='# PaperDesk 每周推送导出\n\n'+files.map(f=>'- ['+f.week+' · '+f.count+' 篇]('+f.name+')').join('\n')+'\n';fs.writeFileSync(path.join(destination,'index.md'),index,'utf8');
 return {directory:destination,files:files.map(f=>f.name),papers:chosen.length};
}
module.exports={exportWeekly};
