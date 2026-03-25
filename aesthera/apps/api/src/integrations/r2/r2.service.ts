import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const accountId = process.env.R2_ACCOUNT_ID ?? ''
const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? ''
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? ''
const bucketName = process.env.R2_BUCKET_NAME ?? ''

let _r2Client: S3Client | null = null

function getR2Client(): S3Client {
  if (!_r2Client) {
    _r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  }
  return _r2Client
}

/**
 * Gera uma presigned PUT URL para upload direto ao R2.
 * TTL padrão: 1 hora (3600s).
 */
export async function generatePresignedPutUrl(
  storageKey: string,
  mimeType: string,
  ttlSeconds = 3600,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    ContentType: mimeType,
  })
  return getSignedUrl(getR2Client(), cmd, { expiresIn: ttlSeconds })
}

/**
 * Gera uma presigned GET URL para leitura do arquivo.
 * TTL padrão: 1 hora (3600s). NUNCA retornar URLs permanentes.
 */
export async function generatePresignedGetUrl(
  storageKey: string,
  ttlSeconds = 3600,
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
  })
  return getSignedUrl(getR2Client(), cmd, { expiresIn: ttlSeconds })
}

/**
 * Verifica se o objeto existe no R2 via HEAD request.
 * Retorna true se existir, false caso contrário.
 */
export async function headObject(storageKey: string): Promise<boolean> {
  try {
    await getR2Client().send(
      new HeadObjectCommand({ Bucket: bucketName, Key: storageKey }),
    )
    return true
  } catch (error: unknown) {
    const err = error as { $metadata?: { httpStatusCode?: number }; name?: string; Code?: string } | undefined
    const httpStatus = err?.$metadata?.httpStatusCode
    if (httpStatus === 404 || err?.name === 'NotFound' || err?.Code === 'NoSuchKey') {
      return false
    }
    // Erros de credencial, rede, bucket inexistente — propagar para tratamento 5xx
    throw error
  }
}

/**
 * Retorna os primeiros `byteCount` bytes do objeto no R2.
 * Usado para validação de magic bytes (MIME type real).
 */
export async function getObjectFirstBytes(
  storageKey: string,
  byteCount: number,
): Promise<Buffer> {
  const cmd = new GetObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    Range: `bytes=0-${byteCount - 1}`,
  })
  const response = await getR2Client().send(cmd)
  if (!response.Body) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
