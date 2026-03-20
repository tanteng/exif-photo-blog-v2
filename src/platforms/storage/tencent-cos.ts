import {
  S3Client,
  CopyObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageListResponse, generateStorageId } from '.';
import { removeUrlProtocol } from '@/utility/url';
import { formatBytes } from '@/utility/number';

const TENCENT_COS_BUCKET =
  process.env.NEXT_PUBLIC_TENCENT_COS_BUCKET ?? '';
const TENCENT_COS_REGION =
  process.env.NEXT_PUBLIC_TENCENT_COS_REGION ?? '';
const TENCENT_COS_CUSTOM_DOMAIN =
  removeUrlProtocol(
    process.env.NEXT_PUBLIC_TENCENT_COS_CUSTOM_DOMAIN) ?? '';
const TENCENT_COS_SECRET_ID =
  process.env.TENCENT_COS_SECRET_ID ?? '';
const TENCENT_COS_SECRET_KEY =
  process.env.TENCENT_COS_SECRET_KEY ?? '';

// COS S3 兼容 endpoint 格式: https://cos.<region>.myqcloud.com
const TENCENT_COS_ENDPOINT = TENCENT_COS_REGION
  ? `https://cos.${TENCENT_COS_REGION}.myqcloud.com`
  : undefined;

// 公开访问 URL：优先使用自定义域名，否则使用默认域名
// 默认域名格式: https://<bucket>.cos.<region>.myqcloud.com
export const TENCENT_COS_BASE_URL = TENCENT_COS_CUSTOM_DOMAIN
  ? `https://${TENCENT_COS_CUSTOM_DOMAIN}`
  : (TENCENT_COS_BUCKET && TENCENT_COS_REGION)
    ? `https://${TENCENT_COS_BUCKET}.cos.${TENCENT_COS_REGION}.myqcloud.com`
    : undefined;

export const tencentCosClient = () => new S3Client({
  region: TENCENT_COS_REGION,
  endpoint: TENCENT_COS_ENDPOINT,
  credentials: {
    accessKeyId: TENCENT_COS_SECRET_ID,
    secretAccessKey: TENCENT_COS_SECRET_KEY,
  },
});

const urlForKey = (key?: string) =>
  `${TENCENT_COS_BASE_URL}/${key}`;

export const isUrlFromTencentCos = (url?: string) =>
  TENCENT_COS_BASE_URL && url?.startsWith(TENCENT_COS_BASE_URL);

export const tencentCosPut = async (
  file: Buffer,
  fileName: string,
): Promise<string> =>
  tencentCosClient().send(new PutObjectCommand({
    Bucket: TENCENT_COS_BUCKET,
    Key: fileName,
    Body: file,
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
    Bucket: TENCENT_COS_BUCKET,
    CopySource: `${TENCENT_COS_BUCKET}.cos.${TENCENT_COS_REGION}.myqcloud.com/${fileNameSource}`,
    Key,
  }))
    .then(() => urlForKey(Key));
};

export const tencentCosList = async (
  Prefix: string,
): Promise<StorageListResponse> =>
  tencentCosClient().send(new ListObjectsCommand({
    Bucket: TENCENT_COS_BUCKET,
    Prefix,
  }))
    .then((data) => data.Contents?.map(({ Key, LastModified, Size }) => ({
      url: urlForKey(Key),
      fileName: Key ?? '',
      uploadedAt: LastModified,
      size: Size ? formatBytes(Size) : undefined,
    })) ?? []);

export const tencentCosDelete = async (Key: string): Promise<void> => {
  await tencentCosClient().send(new DeleteObjectCommand({
    Bucket: TENCENT_COS_BUCKET,
    Key,
  }));
};

export const tencentCosGetSignedUrl = (
  Key: string,
  method: 'GET' | 'PUT',
  expiresIn: number,
) => {
  const client = tencentCosClient();
  const command = method === 'GET'
    ? new GetObjectCommand({ Bucket: TENCENT_COS_BUCKET, Key })
    : new PutObjectCommand({ Bucket: TENCENT_COS_BUCKET, Key });
  return getSignedUrl(client, command, { expiresIn });
};
