#!/bin/bash
set -e

PROJECT_DIR=/opt/exif-photo-blog
BUILD_DIR=/opt/exif-photo-blog-build

# 限制 Node 构建堆内存，避免服务器内存不足时被 OOM Killer 杀掉构建进程。
# 服务器物理内存仅约 3.6G，默认情况下 next build 峰值会打满内存触发 OOM。
# 可通过环境变量覆盖，例如：NODE_BUILD_MEM=1536 bash deploy.sh
NODE_BUILD_MEM="${NODE_BUILD_MEM:-1024}"

echo "📥 Pulling latest code from GitHub..."
cd $PROJECT_DIR
git pull origin main

echo "📦 Preparing build directory..."
rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR
rsync -a --exclude=.next --exclude=node_modules $PROJECT_DIR/ $BUILD_DIR/

echo "📦 Installing dependencies..."
cd $BUILD_DIR
pnpm install

echo "🔨 Building project in separate directory (heap limit: ${NODE_BUILD_MEM}MB)..."
NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_MEM}" pnpm build

echo "🔎 Verifying build integrity..."
# 校验关键产物存在，防止 OOM 中途被杀产出残缺构建后覆盖线上。
# 若校验失败，脚本在此 exit，线上 .next 保持原样，服务不受影响。
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
[ -d .next ] && mv .next .next-old
mv $BUILD_DIR/.next .next

echo "♻️ Restarting PM2 process..."
pm2 reload photo-blog

# 等待服务就绪
sleep 3

# 健康检查：失败则自动回滚到上一份构建，保证服务不中断。
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

echo "🧹 Cleaning up..."
rm -rf .next-old
rm -rf $BUILD_DIR

echo "✅ Deploy complete! Zero downtime achieved."
pm2 status photo-blog
