try {
 const response=await fetch('https://api.openai-next.com/v1/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(55000),headers:{Authorization:`Bearer ${process.env.OPENAI_NEXT_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_NEXT_MODEL,messages:[{role:'user',content:'Reply with JSON only: {"ok":true}'}],response_format:{type:'json_object'},max_completion_tokens:64})})
 if(!response.ok){await response.body?.cancel();throw new Error('AI_HTTP_'+response.status)}
 const body=await response.json(); const value=JSON.parse(body.choices?.[0]?.message?.content??'null');if(value?.ok!==true)throw new Error('AI_PROTOCOL_ERROR')
 console.log(JSON.stringify({result:'PASS',provider:'api.openai-next.com',configuredModel:process.env.OPENAI_NEXT_MODEL,realGeneration:true}))
}catch(error){console.error(JSON.stringify({result:'FAIL',code:/^AI_/.test(error.message)?error.message:'AI_NETWORK_ERROR'}));process.exitCode=1}
