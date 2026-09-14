import fs from 'node:fs'
import {cf,account} from './node-cloudflare-api.mjs'
const state=JSON.parse(fs.readFileSync(new URL('../server/tunnel-state.json',import.meta.url)))
const zones=await cf('/zones?name=autumn427.xyz')
if(zones.length!==1||zones[0].account.id!==account)throw new Error('ZONE_ACCOUNT_MISMATCH')
const zone=zones[0].id
const records=await cf(`/zones/${zone}/dns_records?name=${state.hostname}`)
const content=state.id+'.cfargotunnel.com'
if(records.length) {if(records.length!==1||records[0].type!=='CNAME'||records[0].content!==content||!records[0].proxied)throw new Error('EXISTING_DNS_CONFLICT');console.log('DNS_ALREADY_CONFIGURED')}
else {const r=await cf(`/zones/${zone}/dns_records`,'POST',{type:'CNAME',name:state.hostname,content,proxied:true,ttl:1}); console.log(JSON.stringify({dnsCreated:true,name:r.name,id:r.id}))}
