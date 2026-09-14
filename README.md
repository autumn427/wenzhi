# 问枝 · 人生选择互动游戏

先体验不同选择的代价，再把一件小事带回现实。

- [产品与参赛说明](docs/PRODUCT-SUBMISSION.md)
- [模型接入、启动及发布说明](docs/live-ai.md)
- [知识来源说明](docs/knowledge-base.md)

## 开发与验证

使用 Node.js 24，安装依赖后执行：

```sh
npm ci
npm run typecheck
node --experimental-strip-types scripts/test-action-flow.mjs
node --experimental-strip-types scripts/test-submission-flow.mjs
node --experimental-strip-types scripts/test-echo-context.mjs
node --experimental-strip-types scripts/test-relay-ai.mjs
npm run build
```

`npm run dev` 仅启动前端，可通过 `?demo=1` 检查预设剧情。完整模式需要按 `.dev.vars.example` 配置本机服务端环境，运行 `npm run dev:cloudflare`。不要把 `.dev.vars` 或任何密钥提交到仓库。

`test-submission-flow` 覆盖六条预设选择路径、单路线行动票与草稿隔离；`test-action-flow` 和 `test-relay-ai` 使用模拟接口，不代表真实模型成功率。

本目录为继续开发的源码。`dist/` 是构建产物；部署、竞赛平台提交和公开仓库发布分别执行并验收。
