'use strict';
// Local Markdown + LaTeX rendering. Raw HTML and remote images are never used.
(()=>{
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const parser=new marked.Marked({gfm:true,breaks:true});
 function mathHTML(token){try{return katex.renderToString(token.text,{displayMode:token.display,throwOnError:false,trust:false,strict:'ignore',output:'htmlAndMathml',maxExpand:500,maxSize:20});}catch{return '<code>'+escape(token.text)+'</code>';}}
 parser.use({renderer:{html({text}){return escape(text);},image({text}){return escape(text||'');}},extensions:[
  {name:'mathBlock',level:'block',start:s=>{const m=s.search(/\$\$|\\\[/);return m<0?undefined:m;},tokenizer(s){const m=/^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])(?:\n|$)/.exec(s);if(m)return {type:'mathBlock',raw:m[0],text:m[1]??m[2],display:true};},renderer:mathHTML},
  {name:'mathInline',level:'inline',start:s=>{const m=s.search(/\$|\\\(|\\\[/);return m<0?undefined:m;},tokenizer(s){const m=/^(?:\\\(([\s\S]+?)\\\)|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$(?!\s)([^$\n]+?)\$)/.exec(s);if(m)return {type:'mathInline',raw:m[0],text:m[1]??m[2]??m[3]??m[4],display:m[2]!==undefined||m[3]!==undefined};},renderer:mathHTML}
 ]});
 window.PaperDeskRichText={render(el,source){
  try{const html=parser.parse(String(source||''));el.innerHTML=DOMPurify.sanitize(html,{USE_PROFILES:{html:true,mathMl:true},FORBID_TAGS:['img','style','script','iframe','video','audio','form','input','button'],FORBID_ATTR:['src','srcset','onerror','onclick'],ALLOW_DATA_ATTR:false});
   for(const a of el.querySelectorAll('a')){try{const u=new URL(a.getAttribute('href'));if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error();a.dataset.action='external';a.dataset.url=u.href;a.rel='noopener noreferrer';}catch{a.replaceWith(document.createTextNode(a.textContent));}}
  }catch{el.textContent=source;}
 }};
})();
