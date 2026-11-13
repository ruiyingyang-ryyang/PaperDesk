'use strict';
let renderedDialogKey='',renderedDialogHTML='';
// Keep one dialog and backdrop mounted while its contents are refreshed.
function renderModal(){
 let host=document.getElementById('modal-root');
 if(!host){host=document.createElement('div');host.id='modal-root';document.body.append(host);}
 const html=modalHTML();
 if(!html){host.replaceChildren();renderedDialogKey=renderedDialogHTML='';return false;}
 const key=[modal.kind,modal.id,modal.messageId,modal.field].join(':');
 if(key===renderedDialogKey&&html===renderedDialogHTML)return false;
 const old=host.querySelector('.modal'),focused=host.contains(document.activeElement)?document.activeElement:null;
 const focusId=focused?.id,focusAction=focused?.dataset.action,scroll=old?.querySelector('.balance-modal-body')?.scrollTop||0;
 const template=document.createElement('template');template.innerHTML=html;
 const backdrop=template.content.firstElementChild,next=backdrop.querySelector('.modal');
 const opened=!old||key!==renderedDialogKey;
 if(opened)host.replaceChildren(backdrop);
 else{old.className=next.className;old.replaceChildren(...next.childNodes);}
 renderedDialogKey=key;renderedDialogHTML=html;
 const body=host.querySelector('.balance-modal-body');if(body)body.scrollTop=scroll;
 if(!opened){const target=focusId?[...host.querySelectorAll('[id]')].find(e=>e.id===focusId):focusAction?[...host.querySelectorAll('[data-action]')].find(e=>e.dataset.action===focusAction):null;target?.focus({preventScroll:true});}
 return opened;
}
