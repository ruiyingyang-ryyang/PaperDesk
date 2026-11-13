'use strict';
function range(period='month',now=new Date()){
 if(!['month','7d','30d'].includes(period))throw Error('INVALID_USAGE_RANGE');
 const end=Math.floor(now.getTime()/1000),start=Math.floor(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),period==='month'?1:now.getUTCDate()-(period==='7d'?6:29))/1000);
 return {start,end};
}
const number=n=>Number.isSafeInteger(n)&&n>=0?n:0;
function record(data,{model,usage,at=Date.now()}){
 data.gptUsage||=[];const day=new Date(at).toISOString().slice(0,10);let row=data.gptUsage.find(r=>r.day===day&&r.model===model);
 if(!row){row={day,model,requests:0,reportedRequests:0,inputTokens:0,outputTokens:0,cachedTokens:0};data.gptUsage.push(row);}
 row.requests++;if(usage){row.reportedRequests++;row.inputTokens+=number(usage.prompt_tokens);row.outputTokens+=number(usage.completion_tokens);row.cachedTokens+=number(usage.prompt_tokens_details?.cached_tokens);}
}
function local(data,window){const result={requests:0,reportedRequests:0,inputTokens:0,outputTokens:0,cachedTokens:0};for(const row of data.gptUsage||[]){const day=Date.parse(row.day+'T00:00:00Z');if(day+86400000<=window.start*1000||day>window.end*1000)continue;for(const key of Object.keys(result))result[key]+=number(row[key]);}return result;}
async function official(key,window,{fetcher=fetch}={}){
 const read=async(endpoint)=>{const all=[],seen=new Set();let page='';for(let i=0;i<100;i++){
  const url=new URL('https://api.openai.com/v1/organization/'+endpoint);for(const [k,v]of Object.entries({start_time:window.start,end_time:window.end,bucket_width:'1d',limit:31,...(page?{page}:{})}))url.searchParams.set(k,v);
  let response;try{response=await fetcher(url.href,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});}catch{throw Error('NETWORK_ERROR');}
  if(!response.ok)throw Error([401,403].includes(response.status)?'GPT_ADMIN_AUTH':response.status===429?'GPT_RATE_LIMIT':'GPT_HTTP_'+response.status);
  const data=await response.json();if(!Array.isArray(data.data))throw Error('INVALID_RESPONSE');for(const bucket of data.data){if(!Array.isArray(bucket.results))throw Error('INVALID_RESPONSE');all.push(...bucket.results);}
  if(!data.has_more)return all;if(typeof data.next_page!=='string'||!data.next_page||seen.has(data.next_page))throw Error('INVALID_RESPONSE');seen.add(data.next_page);page=data.next_page;
 }throw Error('USAGE_PAGE_LIMIT');};
 const settle=async p=>{try{return {rows:await p};}catch(e){return {error:e.message};}};
 const [usage,costs]=await Promise.all([settle(read('usage/completions')),settle(read('costs'))]);
 const total={requests:0,inputTokens:0,outputTokens:0,cachedTokens:0};if(usage.rows)for(const row of usage.rows){total.requests+=number(row.num_model_requests);total.inputTokens+=number(row.input_tokens);total.outputTokens+=number(row.output_tokens);total.cachedTokens+=number(row.input_cached_tokens);}
 const amounts={};if(costs.rows)for(const row of costs.rows){const value=Number(row.amount?.value),currency=row.amount?.currency;if(!Number.isFinite(value)||typeof currency!=='string'||! /^[a-zA-Z]{3}$/.test(currency))throw Error('INVALID_RESPONSE');amounts[currency]=(amounts[currency]||0)+value;}
 return {usage:usage.error?{error:usage.error}:total,costs:costs.error?{error:costs.error}:amounts};
}
module.exports={range,record,local,official};
