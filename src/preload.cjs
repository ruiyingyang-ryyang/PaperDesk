'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const commands=new Set(['get-state','writing-generate','test-gpt','rename-group','workspace-panel','api-balance','chat-delete','appearance','reset-app','export-weekly-md','save-settings','language','schedule','run','run-weekly','author-search','cancel','paper-update','load-abstract','abstract-view','chat-send','chat-rename','ai-cancel','test-deepseek','test-serpapi','open-external','export','import','quit']);
contextBridge.exposeInMainWorld('desk',{
  call:async(name,...args)=>{if(!commands.has(name))throw Error('INVALID_COMMAND');const r=await ipcRenderer.invoke(name,...args);if(!r.ok)throw Error(r.error);return r.value;},
  on:(name,fn)=>{if(!['state','progress','error','export-progress'].includes(name))return;const cb=(_e,data)=>fn(data);ipcRenderer.on(name,cb);return()=>ipcRenderer.removeListener(name,cb);}
});
