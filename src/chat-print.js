'use strict';
window.renderChatExport=async({chats,language})=>{
 const zh=language==='zh',root=document.querySelector('#document');root.replaceChildren();
 const add=(parent,tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
 add(root,'h1',zh?'研究问答':'Research questions & answers');
 const toc=add(root,'nav',undefined,'toc');add(toc,'h2',zh?'目录':'Contents');const list=add(toc,'ul');
 chats.forEach((chat,ci)=>{const group=add(list,'li'),a=add(group,'a',chat.title);a.href='#chat-'+ci;const sub=add(group,'ul');const section=add(root,'section',undefined,'conversation');const h=add(section,'h2',chat.title);h.id='chat-'+ci;
  chat.turns.forEach((turn,ti)=>{const id='turn-'+ci+'-'+ti,item=add(sub,'li'),link=add(item,'a',(ti+1)+'. '+turn.question.replace(/\s+/g,' ').slice(0,100));link.href='#'+id;const h3=add(section,'h3',(zh?'问题 ':'Question ')+(ti+1));h3.id=id;add(section,'div',turn.question,'question');add(section,'h4',zh?'回答':'Answer');
   if(!turn.answers.length)add(section,'p',zh?'[暂无回答]':'[No answer]');
   for(const answer of turn.answers){const e=add(section,'div',undefined,'answer');if(answer.status==='complete')window.PaperDeskRichText.render(e,answer.content);else e.textContent=zh?'[回答未完成]':'[Answer incomplete]';}
  });
 });await document.fonts.ready;await new Promise(requestAnimationFrame);return true;
};
