# EdgeOne 缓存策略

本文档说明当前各路由的缓存分类，以及 origin 不可用时 EdgeOne 必须配置的兜底策略。

## 路由分类

### A 类：build-time 完整预渲染（EdgeOne 默认长缓存即可）

路由：

- `/`、`/grid`、`/full`、`/recents`
- `/tag/[tag]`、`/album/[album]`、`/camera/[camera]`、`/lens/[lens]`
- `/year/[year]`、`/focal/[focal]`、`/film/[film]`、`/recipe/[recipe]`
- `/shot-on/[make]/[model]`、`/full/[sortType]/[sortOrder]`

机制：

- `/`、`/grid`、`/full`、`/recents` 使用 `export const dynamic = 'force-static'`（见 `app/page.tsx:14` 等），build 时生成完整 HTML 写入 `.next/server/app/.../page.html`。
- 其他 category 路由使用 `generateStaticParams = staticallyGenerateCategoryIfConfigured(...)`（见 `src/app/static.ts:42-67`），build 时遍历当前 categories 全量预渲染。
- 假设 categories 数量 < `GENERATE_STATIC_PARAMS_LIMIT`（默认 1000，对绝大多数用户来说够用）。

EdgeOne 配置：默认长缓存即可。无需特殊规则。

### B 类：build-time 部分预渲染 + on-demand SSR

路由：

- `/p/[photoId]`（`app/p/[photoId]/page.tsx:38-40`）
- `/p/[photoId]/image`（`app/p/[photoId]/image/route.tsx:9-11`，OG 图）

机制：

- `generateStaticParams` 调 `getAllPublicPhotoIds({ limit: GENERATE_STATIC_PARAMS_LIMIT })`，取**最近 N 张**（已修 `src/photo/query.ts:614-619` 加 `ORDER BY taken_at DESC, id ASC`，不再是任意 1000）。
- `dynamicParams` 默认 `true`：超出 N 的 ID 走 on-demand SSR，渲染成功后由 EdgeOne 缓存。
- ⚠️ **origin 挂掉 + EdgeOne 缓存未命中 = 502**。EdgeOne 必须配 stale-while-revalidate + stale-if-error 兜底。

### C 类：admin / sign-in 等

不缓存，由 EdgeOne 透传即可（默认 `Cache-Control: no-store` 或短 TTL）。

## EdgeOne 当前规则

完整规则定义在 [`edgeone-rules.json`](./edgeone-rules.json)，按优先级从高到低执行：

| 顺序 | 规则名 | 匹配路径 | 缓存策略 |
|---|---|---|---|
| 1 | `RSC 缓存区分` | 全部 | CacheKey 按 `RSC` / `Next-Router-Prefetch` header 分桶（避免 prefetch 污染主缓存） |
| 2 | `edge-cache-photo-og` | `/p/*/image` | TTL 86400s + 智能预刷新 + 离线缓存 |
| 3 | `edge-cache-photo-page` | `/p/*` | TTL 86400s + 智能预刷新 + 离线缓存 |
| 4 | `edge-cache-listing` | `/tag/*`, `/album/*`, `/camera/*`, `/lens/*`, `/recipe/*`, `/film/*`, `/focal/*`, `/year/*`, `/shot-on/*`, `/grid/*`, `/full/*`, `/recents/*` | TTL 86400s + 智能预刷新 + 离线缓存 |

行为说明：

- **Cache.CustomTime** = 自定义缓存 TTL，86400 秒（1 天）
- **CachePrefresh** = 智能缓存预刷新，临近过期时后台异步回源刷新，等价 `stale-while-revalidate`
- **OfflineCache** = 离线缓存，origin 返回 5xx 时返回陈旧缓存，等价 `stale-if-error`

### 导入方式

在 EdgeOne 控制台 → 站点 → 规则引擎 → 规则 → 导入 → 选择 `edgeone-rules.json`。导入时如果有同名规则，会被覆盖。

### A 类路由为什么没列规则

`/`、`/grid`、`/full`、`/recents` 和所有 category 页是 build-time 完整预渲染的静态文件，EdgeOne 默认长缓存即可。无需额外规则。若需要显式控制，可加一条 `cache-control: public, max-age=31536000, immutable`。

## 缓存清理

`deploy.sh:77-82` 部署后会调 `/opt/ops/purge-edgeone-cache.sh` 清缓存。该脚本必须能清掉：

- `/p/*`（包括 `/p/<id>` 和 `/p/<id>/image`）
- `/tag/*`、`/album/*` 等所有 category 页（防止发布新图后旧数据滞留）

B 类规则在每次 deploy 后第一次回源就会刷新，所以 purge 的关键是确保下次回源能拿到新内容。如果 EdgeOne 控制台支持「目录级 purge」，按 `/p/`、`/tag/`、`/album/` 批量清即可。

## 故障排查

| 现象 | 可能原因 |
|------|---------|
| 部署后旧图/旧 tag 还在 | `purge-edgeone-cache.sh` 没覆盖对应路径 |
| origin 挂掉仍 502 | `edge-cache-photo-page` / `edge-cache-photo-og` 规则没启用 OfflineCache，或缓存未命中 |
| 新上传的照片访问 404 | `getPhotoCached` 的 `unstable_cache`（`src/photo/cache.ts:139`）key 没失效 —— 检查 `app/admin/actions.ts` 的 `revalidatePath` 是否覆盖 `/p/[photoId]` 路径 |
| build 时只预渲染 < N 张 | `GENERATE_STATIC_PARAMS_LIMIT` 设太低，或 SQL 没 ORDER BY（现已修） |

## 调高预渲染上限

`src/db/index.ts:12` 改为读 `NEXT_PUBLIC_GENERATE_STATIC_PARAMS_LIMIT`，默认 1000。

调高前注意：

- 每张照片预渲染大约 3 次 DB 查询（photo + photos near + meta），加上 metadata 生成
- 部署机只有 ~3.6 GiB 可用内存（见 `deploy.sh:9-11` OOM 历史），堆上限目前是 2048 MB（commit `0034517d`）
- 实测：1000 张约 30s 增量 build 时间；5000 张预估 2-3 分钟
- 调高后务必跑一次 `pnpm build` 看 BUILD_ID + prerender-manifest.json 是否完整生成