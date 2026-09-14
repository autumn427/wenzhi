# 埋点查看

`scripts/query-telemetry.mjs` 查询 D1 中按天聚合的产品事件。脚本只输出事件计数和数值汇总，不读取用户填写内容、来源正文或完整操作记录。

```powershell
# 查看本地 D1 最近 30 天
npm run metrics:telemetry -- --local

# 查看线上 D1 最近 7 天，并输出 JSON（便于保存或接入报表）
npm run metrics:telemetry -- --days=7 --json

# 需要排查单个版本时，附带原始聚合行
npm run metrics:telemetry -- --days=30 --raw
```

默认查询线上数据库；首次查询线上数据前，确保当前 Wrangler 已完成 `wrangler login`。`--days` 范围为 1—90 天，`--local` 切换到本地 D1。
