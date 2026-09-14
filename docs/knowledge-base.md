# 知乎搜索知识库

Worker 在 `/api/zhihu/search` 成功取得知乎公开回答摘要后，会通过 `ctx.waitUntil` 异步写入 D1 的 `knowledge_sources` 表。每次检索以 `query_hash + source_id + retrieved_at` 去重，因此同一个问题的后续检索仍会保留时间线，便于回溯。

表中只保留由规范化主题词组成的问题提示和来源摘要：标题、截断摘要、知乎原文链接、作者展示名、相关度、权威等级、赞同数、检索时间与发布版本。原始请求正文、完整回答和用户隐私不会写入知识库；邮箱和电话号码会在主题提示中替换为占位符。完整规范化查询只用于运行时哈希和缓存键，不落 D1。

## 查询已保存来源

```powershell
curl "https://wenzhi.autumn427.xyz/api/knowledge/search?query=AI编程转行&count=10"
```

接口只读、仅接受 `GET`，并拒绝带有非本站 `Origin` 的请求。`count` 范围为 1—20；返回的 `retrievedAt` 和 `release` 可用于确认来源快照的时间与版本。若某个问题尚未成功检索，返回空 `items`，不会触发新的知乎请求。

迁移文件为 `migrations/0003_create_knowledge_sources.sql`，部署前使用 Wrangler 执行生产 D1 migration。

## AI 场景价值卡

每次新鲜检索还会写入 `knowledge_scenarios`：目标用户、痛点、AI 的具体作用、可观察的价值信号、限制条件和来源 ID。场景卡由检索摘要确定性生成，便于比赛演示和审计；它不是模型对用户的诊断，也不会保存完整问题或回答。

```powershell
curl "https://wenzhi.autumn427.xyz/api/knowledge/scenario?query=AI编程转行"
```

接口只读并沿用本站 `Origin` 校验；没有成功检索记录时返回 `{"scenario":null}`。新增迁移文件为 `migrations/0004_create_knowledge_scenarios.sql`。
