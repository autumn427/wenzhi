# 问枝实时 AI

正常入口默认开启完整体验。Worker 在服务端调用 `https://api.openai-next.com/v1/chat/completions`，当前模型由 `wrangler.jsonc` 的 `OPENAI_NEXT_MODEL` 配置为 `gpt-5.4-mini`。`?demo=1` 和“先试玩 3 分钟”保留本地示例，避免演示过程中产生模型费用。

实时入口包括三路个性化开场、选择/自由行动续写、未来回信、三宇宙辩论、七天实验、反馈校正。数值与剧情仍经过原有边界校验；模型失败不会被标为实时成功。知乎检索使用独立配置，不会把中转密钥发给知乎。

## 本地启动

将 `.dev.vars.example` 复制为 `.dev.vars`，在本机填写密钥。该文件已被 `.gitignore` 排除。不要将密钥放入 `VITE_*`、前端代码、仓库或截图。

```powershell
npm run typecheck
node --experimental-strip-types scripts/test-relay-ai.mjs
npm run dev:cloudflare
```

仅运行 Vite 不提供 Worker API。通过 Wrangler 地址打开正常首页进行完整测试。

## 发布

使用 Cloudflare 官方 Wrangler 登录，确认目标是 `wenzhi` / `wenzhi.autumn427.xyz`：

```powershell
npx wrangler login
npm run build
npx wrangler deploy --keep-vars
npx wrangler secret put OPENAI_NEXT_API_KEY
```

最后一条命令通过交互式输入设置服务端 secret。先发布移除通用代理的 Worker，再启用密钥。配置文件指定的 base URL 和模型会随 Worker 发布；其他现有变量使用 `--keep-vars` 保留。

发布后检查 `/api/health` 的 `generationProvider` 为 `relay-ai`、`generationModel` 为 `gpt-5.4-mini`，并用合成问题完成一次正常入口生成；只有本地成功不能代表线上已启用。

## 请求边界

- 浏览器只使用六个固定业务接口，`/api/relay/*` 不对外提供。
- 密钥仅留在 Worker 环境；日志只记录模型名、耗时和错误码。
- 上游只允许指定 HTTPS 主机；重定向不跟随，不透传上游错误正文。
- 单次请求有完整响应超时和长度限制。行动续写遇到结构错误或数值引文错误时，最多进行一次受限修复，合计约 54 秒预算；数值修复只能调整评分和引文，不能改写故事来凑依据。授权、限流、超时及行动边界错误不自动重试。部署配置每个客户端 IP 每分钟最多 12 次生成请求。
- 正常体验会将用户主动提交的问题、目标、选择及所需模拟历史发给配置的中转服务，页面在提交前说明用途。

## 2026-09-14 提交体验优化

- 按处境、宇宙、剧情节点和轮次在本机保存行动草稿，重新进入原处境和路线可恢复；不会自动重发。开始体验时保存最近处境，刷新后无需重填整份档案。
- 已通过校验的续写先保存时间线再清理草稿；切换处境或路线后不会把旧请求的错误弹到新路线。
- 走完一条路线即可领取单路线七天行动票。该模板由本地规则结合已完成的行动记录整理，全周 90 分钟；不需要另一次模型调用，也不声称已完成现实验证。
- 三宇宙辩论仍需三条路线完成，但不会清空此前领取的行动票和打卡。
- 现实回声显示共同话题及其原文片段；这是文本线索匹配，不能验证答主身份、亲身经历或结果真实性。
