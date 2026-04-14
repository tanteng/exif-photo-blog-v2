#!/bin/bash
set -e

PROJECT_DIR=/opt/exif-photo-blog
BUILD_DIR=/opt/exif-photo-blog-build

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

echo "🔨 Building project in separate directory..."
pnpm build

echo "🔄 Swapping build output (atomic switch)..."
cd $PROJECT_DIR
rm -rf .next-old
[ -d .next ] && mv .next .next-old
mv $BUILD_DIR/.next .next

echo "♻️ Reloading PM2 process (zero downtime)..."
pm2 reload photo-blog

# 等待服务就绪
sleep 3

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
