# TizhiWise Deployment Runbook / 知体智评部署运行手册

## Scope / 范围

This runbook covers Stage 16 deployment preparation for the API, H5 app, admin console, PostgreSQL, Redis and queue worker infrastructure.

本手册覆盖 Stage 16 发布准备：API、H5、管理后台、PostgreSQL、Redis 与队列基础设施。

## Required environment variables / 必需环境变量

- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string for cache and BullMQ.
- `APP_ENCRYPTION_KEY`: AES-256-GCM application encryption key. Use a production secret manager; never commit the real value.
- `JWT_SECRET`: JWT/HMAC token secret.
- `API_PORT`: API listen port, default `3000`.
- `API_GLOBAL_PREFIX`: API prefix, default `api`.
- `WECHAT_OAUTH_APP_ID`, `WECHAT_OAUTH_APP_SECRET`: WeChat OAuth credentials.
- `WECHAT_PAY_MCH_ID`, `WECHAT_PAY_API_V3_KEY`, `WECHAT_PAY_CERT_SERIAL`: WeChat Pay credentials.
- `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`: LLM provider configuration. Use deterministic mock in CI.

## Local smoke deployment / 本地冒烟部署

```bash
pnpm install
pnpm test:unit
pnpm test:integration
pnpm typecheck
pnpm lint
pnpm build
```

Optional container smoke:

```bash
docker compose up --build
# API: http://localhost:3000/api/health
# H5:  http://localhost:8080/h5/
# Admin: http://localhost:8080/admin/
```

## Database migration / 数据库迁移

```bash
pnpm --filter @tizhice/api migration:run
```

Run migrations before routing production traffic. Rollback only from a verified backup or staging rehearsal.

上线接流量前先执行迁移。回滚必须基于已验证备份或预发演练。

## Worker startup / 队列 Worker 启动

The project is wired for BullMQ/Redis infrastructure. In production run API and workers as separate processes once dedicated worker entrypoints are added:

```bash
pnpm dev:api
# future: pnpm --filter @tizhice/api worker:ai
```

当前项目已接入 BullMQ/Redis 基础设施；后续独立 worker entrypoint 增加后，生产环境应将 API 与 worker 分进程运行。

## Security checklist / 安全检查

- Keep encryption keys, JWT secrets, WeChat Pay keys and LLM keys out of git and logs.
- Confirm `x-trace-id` appears in responses and sensitive payload fields are redacted in structured logs.
- WeChat Pay callbacks must pass signature verification before state mutation.
- H5 health disclaimers and report disclaimers must remain visible.
- Aggregate exports must keep small-cell suppression.

## Release gate / 发布门禁

A release is acceptable only when all commands below pass:

```bash
git diff --check
pnpm test:unit
pnpm test:integration
pnpm typecheck
pnpm lint
pnpm build
```
