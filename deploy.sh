#!/bin/bash
set -e

cd /opt/exif-photo-blog

echo "📥 Pulling latest code from GitHub..."
git pull origin main

echo "📦 Installing dependencies..."
pnpm install

echo "🔨 Building project..."
pnpm build

echo "🔄 Restarting PM2 process..."
pm2 restart photo-blog

echo "✅ Deploy complete!"
pm2 status photo-blog
