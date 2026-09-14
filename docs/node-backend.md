# Node 入口与远程 D1

## 本次交付

服务器版本目录：`/tos-mlp-zgci/wenzhi-backend/releases/node-d1-20260914`。
已在 zjc-online 的 Node v20.20.2 通过独立模拟验证，真实数据库请求数为 0。测试退出后 30120 无监听，5050 和 8899 原有监听保持不变。正式后端尚未启动，缺专用 D1 Token。
`server/supervisord.conf` 指向上述版本，可在凭据与真实数据库验证完成后启用；须先创建 `/dev/shm/wenzhi-backend-30120` 供守护进程 PID/socket 使用，这里不保存数据库。容器重建后的自动启动仍需平台启动配置。

## 范围

`npm run build:server` 把现有 Worker 业务与 Node 适配层编译为 `server-build/server.mjs`。运行环境为 Node 20.20.2 或更新版本，无需服务器安装 npm 依赖、Miniflare、workerd 或本地 SQLite。D1 数据继续在 Cloudflare，不使用 `/dev/shm` 保存数据库。

## 运行

先配置专用环境文件（文件权限 600，父目录 700），参考 `server/server.env.example`。不要把实际凭据提交到仓库或放入 dist。

```sh
node --env-file=/absolute/private/server.env /absolute/release/server-build/server.mjs
```

必填：`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_D1_DATABASE_ID`、`CLOUDFLARE_D1_API_TOKEN`。Token 需要目标账户的 D1 写入权限，因为应用包含写入。不要使用开发机 Wrangler 登录 token。账户和数据库 ID 已在项目 wrangler.jsonc 中，密钥需单独提供。

默认只监听 `127.0.0.1:30120`。代码拒绝 5050、8899。启动前执行只读 `SELECT 1`，连不上 D1 就退出，不伪装健康服务。`/api/ready` 检查数据库连通性，`/api/health` 仅报告进程与配置状态。

独立编译包只提供 API；如需同时提供网页，将当前 dist 放在 server-build 的同级目录。没有 dist 不影响 API；网页返回 404。

公网接入另行配置 HTTPS 反向代理，PUBLIC_ORIGIN 必须设为浏览器访问的真实源。代理不能任意传入可信 IP，本版仅按连接对端限流；经过本机代理时多个用户共用限额。不要在生产多实例环境依赖这个进程内限流，应在入口部署统一限流。

## 数据和协议

远程层使用 Cloudflare REST query 接口，支持当前业务所用的 `prepare().bind().first()/all()/run()` 和 `batch()`。batch 作为一份请求发送，保持返回顺序；不拆成逐条请求。不实现原始 SQL 浏览器接口、`raw`、`dump`、`exec` 或会话 bookmark API。参数支持字符串、有限数值和 null，其他类型明确拒绝。

依据：https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/

超时、HTTP 错误和 SQL 失败会抛出脱敏错误，不向客户端输出 token、参数或上游原文。请求不自动重试，避免重复写入；网络中断时写入状态可能未知，业务操作应先查询确认再重试。

启动不执行迁移。现有 D1 数据不复制、不清空。OAuth 使用前还需单独审核并应用 0005 迁移、配置知乎应用凭据及验证 state 回传。

进程缓存只用于可缓存内容，限制数量/大小及有效期；重启丢失缓存不影响 D1。后台任务失败记录脱敏日志，关停最多等待 10 秒；后台写入不是持久队列。

## 验收边界

`npm run test:server`：模拟官方 REST 返回格式，覆盖绑定、读取、写入、batch、超时、上游错误、缓存、限流、真实 Worker 经 Node HTTP 的响应、cookie、私有文件隔离与后台任务。

`node server-build/smoke.mjs`：可在服务器现有 Node 下验证兼容性，使用模拟 D1、随机临时端口，不调用真实数据库。

通过模拟测试不等于真实 D1 联调完成。没有专用 Token 时不能确认线上权限、数据库结构、REST 参数兼容性或真实写入行为；在独立测试库验证后才切换正式流量。
