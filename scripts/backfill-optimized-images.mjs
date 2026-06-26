#!/usr/bin/env node
/**
 * Backfill missing optimized image variants (-sm / -md / -lg) for photos
 * stored in Tencent COS, generating them with sharp and uploading back.
 *
 * Why: OG image generation needs the -md variant. Photos uploaded before
 * the optimization pipeline existed (or where it failed) lack these files,
 * which forced an unreliable /_next/image fallback during build.
 *
 * Usage (run ON the server, inside /opt/exif-photo-blog so .env + deps load):
 *   node --env-file=.env scripts/backfill-optimized-images.mjs --dry-run
 *   node --env-file=.env scripts/backfill-optimized-images.mjs           # real run
 *   node --env-file=.env scripts/backfill-optimized-images.mjs --limit 20
 *
 * Safe by design:
 *   - Never overwrites an existing variant (skips ones already present).
 *   - Never touches original photo-<id>.<ext> files.
 *   - --dry-run only reports; no downloads, no uploads.
 */

import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

// ---- Config (matches src/photo/storage/index.ts) ----
const OPTIMIZED_FILE_SIZES = [
  { suffix: 'sm', size: 200, quality: 90 },
  { suffix: 'md', size: 640, quality: 90 },
  { suffix: 'lg', size: 1080, quality: 80 },
];
const EXTENSION_OPTIMIZED = 'jpg';
const PREFIX_PHOTO = 'photo-';

const BUCKET = process.env.NEXT_PUBLIC_TENCENT_COS_BUCKET ?? '';
const REGION = process.env.NEXT_PUBLIC_TENCENT_COS_REGION ?? '';
const SECRET_ID = process.env.TENCENT_COS_SECRET_ID ?? '';
const SECRET_KEY = process.env.TENCENT_COS_SECRET_KEY ?? '';
const ENDPOINT = `https://cos.${REGION}.myqcloud.com`;

// ---- CLI args ----
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : Infinity;

if (!BUCKET || !REGION || !SECRET_ID || !SECRET_KEY) {
  console.error('Missing COS env vars. Run with: node --env-file=.env ...');
  process.exit(1);
}

const client = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: { accessKeyId: SECRET_ID, secretAccessKey: SECRET_KEY },
});

// Parse a key like "photo-AbCd1234.jpeg" or "photo-AbCd1234-md.jpg"
// Returns { base: "photo-AbCd1234", suffix: 'md'|null, ext }
const SUFFIXES = OPTIMIZED_FILE_SIZES.map((s) => s.suffix);
function parseKey(key) {
  const dot = key.lastIndexOf('.');
  if (dot < 0) return null;
  const nameNoExt = key.slice(0, dot);
  const ext = key.slice(dot + 1);
  const dash = nameNoExt.lastIndexOf('-');
  const maybeSuffix = dash >= 0 ? nameNoExt.slice(dash + 1) : '';
  if (SUFFIXES.includes(maybeSuffix)) {
    return { base: nameNoExt.slice(0, dash), suffix: maybeSuffix, ext };
  }
  return { base: nameNoExt, suffix: null, ext };
}

async function listAllPhotoObjects() {
  const all = [];
  let token;
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: PREFIX_PHOTO,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    for (const o of res.Contents ?? []) all.push(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return all;
}

async function getObjectBuffer(key) {
  const res = await client.send(new GetObjectCommand({
    Bucket: BUCKET, Key: key,
  }));
  const chunks = [];
  for await (const c of res.Body) chunks.push(c);
  return Buffer.concat(chunks);
}

async function main() {
  console.log(`\n[backfill] bucket=${BUCKET} region=${REGION} ` +
    `dryRun=${DRY_RUN} limit=${LIMIT}\n`);

  const keys = await listAllPhotoObjects();
  console.log(`[backfill] total photo-* objects: ${keys.length}`);

  // Group by base
  const groups = new Map(); // base -> { originalExt, present:Set<suffix> }
  for (const key of keys) {
    const p = parseKey(key);
    if (!p) continue;
    if (!groups.has(p.base)) {
      groups.set(p.base, { originalExt: null, present: new Set() });
    }
    const g = groups.get(p.base);
    if (p.suffix) g.present.add(p.suffix);
    else g.originalExt = p.ext; // original (no suffix)
  }

  // Find originals missing one or more variants
  const todo = [];
  for (const [base, g] of groups) {
    if (!g.originalExt) continue; // no original to source from; skip
    const missing = SUFFIXES.filter((s) => !g.present.has(s));
    if (missing.length) todo.push({ base, ext: g.originalExt, missing });
  }

  console.log(`[backfill] originals total: ` +
    `${[...groups.values()].filter((g) => g.originalExt).length}`);
  console.log(`[backfill] originals missing >=1 variant: ${todo.length}`);

  // Summary of missing-by-suffix
  const missCount = { sm: 0, md: 0, lg: 0 };
  for (const t of todo) for (const m of t.missing) missCount[m]++;
  console.log(`[backfill] missing variants: ` +
    `sm=${missCount.sm} md=${missCount.md} lg=${missCount.lg}\n`);

  if (DRY_RUN) {
    console.log('[backfill] DRY RUN — first 20 originals needing work:');
    todo.slice(0, 20).forEach((t) =>
      console.log(`  ${t.base}.${t.ext}  → missing: ${t.missing.join(',')}`));
    console.log(`\n[backfill] dry run done. Re-run without --dry-run ` +
      `to generate & upload.`);
    return;
  }

  let done = 0;
  let uploaded = 0;
  let failed = 0;
  for (const t of todo) {
    if (done >= LIMIT) break;
    done++;
    const originalKey = `${t.base}.${t.ext}`;
    try {
      const buf = await getObjectBuffer(originalKey);
      for (const suffix of t.missing) {
        const meta = OPTIMIZED_FILE_SIZES.find((s) => s.suffix === suffix);
        const out = await sharp(buf)
          .rotate()
          .resize(meta.size, undefined, { withoutEnlargement: true })
          .toFormat('jpeg', { quality: meta.quality })
          .toBuffer();
        const destKey = `${t.base}-${suffix}.${EXTENSION_OPTIMIZED}`;
        await client.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: destKey,
          Body: out,
          ContentType: 'image/jpeg',
        }));
        uploaded++;
      }
      console.log(`  [${done}/${Math.min(todo.length, LIMIT)}] ` +
        `${originalKey} → +${t.missing.join(',')}`);
    } catch (e) {
      failed++;
      console.error(`  [FAIL] ${originalKey}: ${e.message}`);
    }
  }

  console.log(`\n[backfill] processed=${done} variantsUploaded=${uploaded} ` +
    `failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
