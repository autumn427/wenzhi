# Node backend configuration — 2026-09-14

- SSH destination: `zjc-online`.
- Release: `/tos-mlp-zgci/wenzhi-backend/releases/node-d1-20260914`.
- Environment file: `/tos-mlp-zgci/wenzhi-backend/.runtime/server.env`, owner root, mode 600; parent mode 700. Never copy this file into source control or logs.
- Dedicated Cloudflare token: `wenzhi-zjc-d1`, D1 Edit on the selected Cloudflare account. This permission covers the account's D1 resources, not only one database. UI expiry: December 1, 2026. Replace the token before expiry.
- Database: existing `wenzhi-contributions` in Cloudflare D1. No local database or migrations were created.
- Service listens at `127.0.0.1:30120`. It is not a public endpoint. Ports 5050 and 8899 were left unchanged.
- Independent Supervisor config: `server/supervisord.conf` in the release. It does not modify the server's existing Supervisor instance.
- Verified ordinary SELECT, numeric/string/null binding, ordered batch SELECT, `/api/ready`, service RUNNING and environment permissions. Live verification made zero database mutations.
- AI and Zhihu credentials are not configured in this Node service. Existing production Worker/DNS are unchanged.

## Status

```sh
/root/miniconda3/bin/supervisorctl -c /tos-mlp-zgci/wenzhi-backend/releases/node-d1-20260914/server/supervisord.conf status
curl --fail http://127.0.0.1:30120/api/ready
```

Supervisor restarts the backend after unexpected exits, but host/container boot integration is not configured. After a server reboot, first ensure port 30120 is free and the independent Supervisor is not running, then:

```sh
mkdir -p /dev/shm/wenzhi-backend-30120
chmod 700 /dev/shm/wenzhi-backend-30120
/root/miniconda3/bin/supervisord -c /tos-mlp-zgci/wenzhi-backend/releases/node-d1-20260914/server/supervisord.conf
```

For a live read-only D1 check:

```sh
node --env-file=/tos-mlp-zgci/wenzhi-backend/.runtime/server.env /tos-mlp-zgci/wenzhi-backend/releases/node-d1-20260914/server/verify-d1-live.mjs
```
