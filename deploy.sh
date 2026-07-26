#!/bin/bash
set -e

PROJECT_DIR=/opt/exif-photo-blog
BUILD_DIR=/opt/exif-photo-blog-build

# 服务器仅 3.6G 物理内存，默认 2048 MB 堆上限；可经 NODE_BUILD_MEM 覆盖。
NODE_BUILD_MEM="${NODE_BUILD_MEM:-2048}"

# 预清理：build 之前释放磁盘。多次 deploy 后 .next-old 历史快照累积 + 上次失败的
# $BUILD_DIR 残留会让 build 期间 ENOSPC。先清再 build，失败 deploy 也能回收。
echo "🧹 Pre-deploy cleanup..."
rm -rf $BUILD_DIR
ls -1dt .next-old.* 2>/dev/null | tail -n +2 | xargs -r rm -rf
if [ -d .next-old ]; then
  mv .next-old ".next-old.$(date +%Y%m%d-%H%M%S)"
fi

# tailwindcss v4 @tailwindcss/oxide 峰值吃 3+ GB 内存，主机仅 3.6 GiB 物理内存，
# 全靠 swap 兜底。加 4 GB 高优先级 swap 文件，幂等：已存在则跳过。
if [ ! -f /swapfile3 ]; then
  echo "💾 Creating 4 GB swap file /swapfile3 (one-time, total swap 10 GB)..."
  fallocate -l 4G /swapfile3 || dd if=/dev/zero of=/swapfile3 bs=1M count=4096 status=none
  chmod 600 /swapfile3
  mkswap /swapfile3
  swapon -p -1 /swapfile3
  grep -q '/swapfile3' /etc/fstab || echo '/swapfile3 none swap sw,pri=-1 0 0' >> /etc/fstab
fi

# page cache 在 build 时用不到，drop 掉纯赚。
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true

# 注意：曾尝试 `systemctl restart tat_agent` 回收 RSS，但 tat_agent 管所有 terminal
# sessions（含 SSH），restart 会把当前 ssh 会话一起杀掉。已停用。

echo "📥 Pulling latest code from GitHub..."
cd $PROJECT_DIR
git pull origin main

echo "📦 Preparing build directory..."
mkdir -p $BUILD_DIR
rsync -a --exclude=.next --exclude=node_modules $PROJECT_DIR/ $BUILD_DIR/

echo "📦 Installing dependencies..."
cd $BUILD_DIR
pnpm install

echo "🔨 Building project in separate directory (heap limit: ${NODE_BUILD_MEM}MB)..."
NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_MEM}" pnpm build

echo "🔎 Verifying build integrity..."
# 校验关键产物存在，防止 OOM 中途被杀产出残缺构建后覆盖线上。
if [ ! -f "$BUILD_DIR/.next/BUILD_ID" ]; then
  echo "❌ Build verification failed: BUILD_ID missing — build likely killed (OOM?) or incomplete."
  echo "   Aborting deploy. Live .next is untouched, service stays online."
  exit 1
fi
if [ ! -f "$BUILD_DIR/.next/prerender-manifest.json" ]; then
  echo "❌ Build verification failed: prerender-manifest.json missing — incomplete build."
  echo "   Aborting deploy. Live .next is untouched, service stays online."
  exit 1
fi
echo "✅ Build verified (BUILD_ID: $(cat $BUILD_DIR/.next/BUILD_ID))"

echo "🔄 Swapping build output (atomic switch)..."
cd $PROJECT_DIR
rm -rf .next-old
# 关键：合并旧 .next/static 到新 .next/static，避免旧 HTML（浏览器/CDN 缓存）里的
# chunk hash 在新构建里缺失导致 404。新 static 覆盖同名，旧 static 独有保留。
if [ -d .next/static ] && [ -d "$BUILD_DIR/.next/static" ]; then
  echo "   Merging old static chunks into new build (preserves old HTML compatibility)..."
  rsync -a --ignore-existing .next/static/ "$BUILD_DIR/.next/static/"
fi
[ -d .next ] && mv .next .next-old
mv $BUILD_DIR/.next .next

echo "♻️ Restarting PM2 process..."
pm2 reload photo-blog
sleep 3

# 健康检查：失败则自动回滚到上一份构建。
echo "🩺 Health check..."
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3000/ || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Health check failed (HTTP $HTTP_CODE). Rolling back to previous build..."
  rm -rf .next
  [ -d .next-old ] && mv .next-old .next
  pm2 reload photo-blog
  echo "↩️ Rolled back. Please investigate the new build."
  exit 1
fi
echo "✅ Health check passed (HTTP 200)"

echo "🌐 Purging EdgeOne page cache..."
if [ -f "/opt/ops/purge-edgeone-cache.sh" ]; then
  bash "/opt/ops/purge-edgeone-cache.sh" || echo "⚠️ EdgeOne cache purge failed (non-fatal)"
else
  echo "⚠️ purge-edgeone-cache.sh not found, skipping cache purge"
fi

echo "🧹 Cleaning up build workspace..."
rm -rf $BUILD_DIR
# 部署成功后把 .next-old 转成时间戳格式，让下次 deploy 的预清理 glob 能命中。
# 若失败（已自动回滚），.next-old 已被 mv 回 .next，此步 no-op。
if [ -d .next-old ]; then
  mv .next-old ".next-old.$(date +%Y%m%d-%H%M%S)"
fi

echo "✅ Deploy complete! Zero downtime achieved."
pm2 status photo-blog