import { build } from 'esbuild'
await build({ entryPoints: ['server/main.mjs'], outfile: 'server-build/server.mjs', bundle: true, platform: 'node', target: 'node20', format: 'esm', sourcemap: false })
await build({ entryPoints: ['server/smoke.mjs'], outfile: 'server-build/smoke.mjs', bundle: true, platform: 'node', target: 'node20', format: 'esm', sourcemap: false })
console.log('Built standalone Node server: server-build/server.mjs (no runtime npm install required)')
