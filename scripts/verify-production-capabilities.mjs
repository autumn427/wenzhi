import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
const nodeMode=process.argv.includes('--node')
const origin=nodeMode?'https://wenzhi-origin.autumn427.xyz':'https://wenzhi.autumn427.xyz'
const context='部署验收使用的虚构模拟：一名学生希望做一个整理公开文献笔记的小工具，已完成一个能运行的最小原型。模拟中选择了系统学习路线，每天最多投入十分钟，七天最多九十分钟。当前困惑是工具能否真的减少整理时间，而不是继续增加功能。希望用已有电脑和公开材料验证，不购买设备，不上传个人隐私，也不承诺实际效果。'
const jobs=[['zhihu','/api/zhihu/search',{query:'AI 辅助学习 时间管理',count:1}],['ai','/api/reality-experiment',{context}]]
await Promise.all(jobs.filter(([name])=>!process.argv.includes('--only-zhihu')||name==='zhihu').map(async([name,route,body])=>{
 try{
  const headers={'Content-Type':'application/json',Origin:'https://wenzhi.autumn427.xyz'}
  if(nodeMode){if(!process.env.NODE_GATEWAY_SECRET)throw new Error('GATEWAY_SECRET_MISSING');headers['X-Wenzhi-Gateway']=process.env.NODE_GATEWAY_SECRET;headers['X-Wenzhi-Client-IP']='127.0.0.1'}
  const r=await fetch(origin+route,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(65000)})
  const raw=await r.text();let value;try{value=JSON.parse(raw)}catch{console.log(JSON.stringify({capability:name,status:r.status,contentType:r.headers.get('Content-Type'),bodyPreview:raw.slice(0,150)}));process.exitCode=1;return}
  const valid=name==='ai'?value.experiment?.dailyTasks?.length===7:Array.isArray(value.search?.items)
  console.log(JSON.stringify({capability:name,status:r.status,backend:r.headers.get('X-Wenzhi-Backend')||(nodeMode?'node-origin':'worker'),source:value.source,items:value.search?.items?.length,days:value.experiment?.dailyTasks?.length,error:value.error?.code}))
  if(!r.ok||!valid)process.exitCode=1
 }catch {console.log(JSON.stringify({capability:name,error:'REQUEST_FAILED'}));process.exitCode=1}
}))
