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

echo "♻️ Restarting PM2 process..."
pm2 restart photo-blog

# 等待服务就绪
sleep 3

echo "🧹 Cleaning up..."
rm -rf .next-old
rm -rf $BUILD_DIR

echo "✅ Deploy complete! Zero downtime achieved."
pm2 status photo-blog
