#!/bin/bash
set -e

PROJECT_DIR=/opt/exif-photo-blog
BUILD_DIR=/opt/exif-photo-blog-build

# 限制 Node 构建堆内存，避免服务器内存不足时被 OOM Killer 杀掉构建进程。
# 服务器物理内存仅约 3.6G，默认情况下 next build 峰值会打满内存触发 OOM。
# Tailwind 预编译已挪出 webpack（pnpm build:css），但 webpack 模块图本身仍需约 1.1 GiB 峰值；
# 所以默认堆上限从 1024 提到 2048。仍可通过环境变量覆盖，例如：NODE_BUILD_MEM=1536 bash deploy.sh
NODE_BUILD_MEM="${NODE_BUILD_MEM:-2048}"

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
# 关键：先把旧 .next/static 合并到新 .next/static，让旧 HTML 引用的 chunk 依然存在。
# 这是 Next.js 部署的经典 404 场景 —— 旧 HTML（浏览器缓存 / CDN 边缘缓存）里的 chunk hash
# 在新构建里不存在，导致 GET /_next/static/chunks/xxx.js 404。
# 合并策略：新 static 完全覆盖同名文件（新构建为准），旧 static 里独有的文件保留。
if [ -d .next/static ] && [ -d "$BUILD_DIR/.next/static" ]; then
  echo "   Merging old static chunks into new build (preserves old HTML compatibility)..."
  rsync -a --ignore-existing .next/static/ "$BUILD_DIR/.next/static/"
fi
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

echo "🧹 Cleaning up build workspace..."
rm -rf $BUILD_DIR
# 注意：.next-old 故意保留，作为过渡期兜底 —— 上次部署的 static chunks 已经通过
# rsync 合并到当前 .next/static 里了，.next-old 仅供极端情况下人工回滚。
# 保留 3 份历史，防止磁盘胀死。
echo "🧹 Rotating .next-old snapshots (keep last 3)..."
ls -1dt .next-old.* 2>/dev/null | tail -n +4 | xargs -r rm -rf
if [ -d .next-old ]; then
  mv .next-old ".next-old.$(date +%Y%m%d-%H%M%S)"
fi

echo "✅ Deploy complete! Zero downtime achieved."
pm2 status photo-blog
