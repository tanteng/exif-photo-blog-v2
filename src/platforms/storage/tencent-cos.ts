import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageListResponse, generateStorageId } from '.';
import { formatBytes } from '@/utility/number';

const TENCENT_COS_BUCKET = process.env.NEXT_PUBLIC_TENCENT_COS_BUCKET ?? '';
const TENCENT_COS_REGION = process.env.NEXT_PUBLIC_TENCENT_COS_REGION ?? '';
const TENCENT_COS_SECRET_ID = process.env.TENCENT_COS_SECRET_ID ?? '';
const TENCENT_COS_SECRET_KEY = process.env.TENCENT_COS_SECRET_KEY ?? '';
const TENCENT_COS_APP_ID = process.env.NEXT_PUBLIC_TENCENT_COS_APP_ID ?? '';

// 自定义域名（可选）
const TENCENT_COS_CUSTOM_DOMAIN = process.env.NEXT_PUBLIC_TENCENT_COS_DOMAIN ?? '';

// 腾讯云 COS 的 endpoint 格式
const TENCENT_COS_ENDPOINT = TENCENT_COS_REGION
  ? `cos.${TENCENT_COS_REGION}.myqcloud.com`
  : undefined;

// Bucket name with optional appId (newer COS buckets may not need appId)
const getBucketName = () => TENCENT_COS_APP_ID 
  ? `${TENCENT_COS_BUCKET}-${TENCENT_COS_APP_ID}` 
  : TENCENT_COS_BUCKET;

// 使用自定义域名或默认的 COS 地址
export const TENCENT_COS_BASE_URL = TENCENT_COS_CUSTOM_DOMAIN
  ? `https://${TENCENT_COS_CUSTOM_DOMAIN}`
  : (TENCENT_COS_BUCKET && TENCENT_COS_ENDPOINT
      ? (TENCENT_COS_APP_ID 
          ? `https://${TENCENT_COS_BUCKET}-${TENCENT_COS_APP_ID}.${TENCENT_COS_ENDPOINT}`
          : `https://${TENCENT_COS_ENDPOINT}/${TENCENT_COS_BUCKET}`)
      : undefined);

export const tencentCosClient = () => new S3Client({
  region: TENCENT_COS_REGION,
  endpoint: `https://${TENCENT_COS_ENDPOINT}`,
  credentials: {
    accessKeyId: TENCENT_COS_SECRET_ID,
    secretAccessKey: TENCENT_COS_SECRET_KEY,
  },
  forcePathStyle: false,
});

const urlForKey = (key?: string) => `${TENCENT_COS_BASE_URL}/${key}`;

export const isUrlFromTencentCos = (url?: string) =>
  TENCENT_COS_BASE_URL && url?.startsWith(TENCENT_COS_BASE_URL);

export const tencentCosPut = async (
  file: Buffer,
  fileName: string,
): Promise<string> =>
  tencentCosClient().send(new PutObjectCommand({
    Bucket: getBucketName(),
    Key: fileName,
    Body: file,
    ACL: 'public-read',
  }))
    .then(() => urlForKey(fileName));

export const tencentCosCopy = async (
  fileNameSource: string,
  fileNameDestination: string,
  addRandomSuffix?: boolean,
) => {
  const name = fileNameSource.split('.')[0];
  const extension = fileNameSource.split('.')[1];
  const Key = addRandomSuffix
    ? `${name}-${generateStorageId()}.${extension}`
    : fileNameDestination;
  return tencentCosClient().send(new CopyObjectCommand({
    Bucket: getBucketName(),
    CopySource: fileNameSource,
    Key,
    ACL: 'public-read',
  }))
    .then(() => urlForKey(fileNameDestination));
};

export const tencentCosList = async (
  Prefix: string,
): Promise<StorageListResponse> =>
  tencentCosClient().send(new ListObjectsCommand({
    Bucket: getBucketName(),
    Prefix,
  }))
    .then((data) => data.Contents?.map(({ Key, LastModified, Size }) => ({
      url: urlForKey(Key),
      fileName: Key ?? '',
      uploadedAt: LastModified,
      size: Size ? formatBytes(Size) : undefined,
    })) ?? []);

export const tencentCosDelete = async (Key: string) => {
  tencentCosClient().send(new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key,
  }));
};

export const tencentCosGetSignedUrl = async (
  Key: string,
  method: 'GET' | 'PUT',
  expiresIn: number,
) => {
  const client = tencentCosClient();
  const command = method === 'GET'
    ? new GetObjectCommand({ Bucket: getBucketName(), Key })
    : new PutObjectCommand({ Bucket: getBucketName(), Key, ACL: 'public-read' });
  
  const signedUrl = await getSignedUrl(client, command, { expiresIn });
  
  // 如果使用自定义域名，替换 URL 中的 endpoint
  if (TENCENT_COS_CUSTOM_DOMAIN) {
    return signedUrl.replace(
      `${getBucketName()}.${TENCENT_COS_ENDPOINT}`,
      TENCENT_COS_CUSTOM_DOMAIN
    );
  }
  
  return signedUrl;
};
