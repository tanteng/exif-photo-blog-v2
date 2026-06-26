#!/usr/bin/env node
/**
 * Delete 5 specific orphan ARW-RAW files (mis-named .jpeg, NOT in DB)
 * from Tencent COS. One-off cleanup. Backup already taken on server at
 * /opt/exif-photo-blog/backup-orphan-raw/ before running this.
 *
 * Usage: node --env-file=.env scripts/delete-orphan-raw.mjs
 */
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

const BUCKET = process.env.NEXT_PUBLIC_TENCENT_COS_BUCKET ?? '';
const REGION = process.env.NEXT_PUBLIC_TENCENT_COS_REGION ?? '';
const SECRET_ID = process.env.TENCENT_COS_SECRET_ID ?? '';
const SECRET_KEY = process.env.TENCENT_COS_SECRET_KEY ?? '';

const KEYS = [
  'photo-6RGKhQEsRmSICVwX.jpeg',
  'photo-8qlmgXyLLA2vztOO.jpeg',
  'photo-9nXVzQjJ3dbH25Th.jpeg',
  'photo-LN6l1QlPs2MFsLWd.jpeg',
  'photo-M3BTTF6gAWwozHnT.jpeg',
];

const client = new S3Client({
  region: REGION,
  endpoint: `https://cos.${REGION}.myqcloud.com`,
  credentials: { accessKeyId: SECRET_ID, secretAccessKey: SECRET_KEY },
});

async function main() {
  console.log(`[delete] bucket=${BUCKET} target=${KEYS.length} files\n`);
  let deleted = 0;
  for (const Key of KEYS) {
    try {
      // Confirm it exists first
      const head = await client.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key }));
      const sizeMB = (head.ContentLength / 1024 / 1024).toFixed(1);
      await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key }));
      // Verify gone
      let gone = false;
      try {
        await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key }));
      } catch { gone = true; }
      console.log(`  ${gone ? 'DELETED' : 'STILL EXISTS?'} ${Key} (${sizeMB}MB)`);
      if (gone) deleted++;
    } catch (e) {
      console.log(`  SKIP ${Key}: ${e.name} (${e.message})`);
    }
  }
  console.log(`\n[delete] done. deleted=${deleted}/${KEYS.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
