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

// 自定义域名（可选）- 用于用户访问时显示
const TENCENT_COS_CUSTOM_DOMAIN = process.env.NEXT_PUBLIC_TENCENT_COS_DOMAIN ?? '';

// 腾讯云 COS 的 endpoint 格式
const TENCENT_COS_ENDPOINT = TENCENT_COS_REGION
  ? `cos.${TENCENT_COS_REGION}.myqcloud.com`
  : undefined;

// Bucket name with optional appId (newer COS buckets may not need appId)
const getBucketName = () => TENCENT_COS_APP_ID 
  ? `${TENCENT_COS_BUCKET}-${TENCENT_COS_APP_ID}` 
  : TENCENT_COS_BUCKET;

// COS 默认地址（服务器使用）- 使用Virtual Host Style格式
export const TENCENT_COS_BASE_URL = TENCENT_COS_BUCKET && TENCENT_COS_ENDPOINT
  ? `https://${getBucketName()}.${TENCENT_COS_ENDPOINT}`
  : undefined;

// 获取用户访问的 URL（使用自定义域名）
export const getTencentCosUserUrl = (cosUrl: string): string => {
  if (!TENCENT_COS_CUSTOM_DOMAIN || !cosUrl) {
    return cosUrl;
  }

  // 构建可能的 COS 基础URL格式 - Virtual Host Style
  const bucketWithAppId = getBucketName();

  const cosBaseUrls = [
    // Virtual Host格式: bucket-appId.cos.region.myqcloud.com
    `https://${bucketWithAppId}.${TENCENT_COS_ENDPOINT}`,
  ];

  for (const baseUrl of cosBaseUrls) {
    if (cosUrl.includes(baseUrl)) {
      return cosUrl.replace(baseUrl, TENCENT_COS_CUSTOM_DOMAIN);
    }
  }

  // 如果都匹配不到，返回原始URL
  return cosUrl;
};

// 上传时使用默认 COS 地址
const getUploadBaseUrl = () => TENCENT_COS_BUCKET && TENCENT_COS_ENDPOINT
  ? `https://${getBucketName()}.${TENCENT_COS_ENDPOINT}`
  : undefined;

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

// 上传用的 URL（不使用自定义域名）
const uploadUrlForKey = (key?: string) => `${getUploadBaseUrl()}/${key}`;

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
    // 上传成功返回 COS 默认地址（服务器需要用这个 URL 下载图片提取 EXIF）
    .then(() => uploadUrlForKey(fileName));

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
  
  // 暂时全部使用默认 COS 地址（服务器无法访问自定义域名）
  return signedUrl;
};
