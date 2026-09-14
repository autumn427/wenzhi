import fs from 'node:fs'
import {createRemoteD1} from './d1-remote.mjs'
const db=createRemoteD1({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,databaseId:process.env.CLOUDFLARE_D1_DATABASE_ID,token:process.env.CLOUDFLARE_D1_API_TOKEN})
try {
 const schema=await db.prepare('PRAGMA table_info(d1_migrations)').all()
 if(!schema.results.some(c=>c.name==='name'))throw new Error('MIGRATION_SCHEMA_UNEXPECTED')
 for(const name of ['0003_create_knowledge_sources.sql','0004_create_knowledge_scenarios.sql']) {
  if(await db.prepare('SELECT name FROM d1_migrations WHERE name = ?').bind(name).first()){console.log(name+': already applied');continue}
  const sql=fs.readFileSync(new URL('./knowledge-migrations/'+name,import.meta.url),'utf8').replace(/^--.*$/gm,'')
  const statements=sql.split(';').map(s=>s.trim()).filter(Boolean)
  if(statements.length!==2||!statements.every(s=>/^CREATE (TABLE|INDEX) IF NOT EXISTS /.test(s)))throw new Error('UNEXPECTED_MIGRATION_SQL')
  await db.batch([...statements.map(s=>db.prepare(s)),db.prepare('INSERT INTO d1_migrations (name) VALUES (?)').bind(name)])
  console.log(name+': applied')
 }
}catch(error){console.error(error.code??'MIGRATION_FAILED');process.exitCode=1}
