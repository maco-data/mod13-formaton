import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAdmin } from '../../shared/middleware/auth';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { badRequest, ok } from '../../shared/utils/response';
import { validateEvidenceUploadInput } from '../../shared/validation/evidence';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'eu-west-1' });
const EXPIRES_IN_SECONDS = 900;

type PresignUploadInput = {
  fileName?: string;
  contentType?: string;
  folder?: string;
};

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeFolder(folder?: string): string {
  const normalized = (folder ?? 'general')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');

  return normalized || 'general';
}

export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  if (!event.body) return badRequest('Body requerido');

  let input: PresignUploadInput;
  try {
    input = JSON.parse(event.body);
  } catch {
    return badRequest('JSON inválido');
  }

  const bucket = process.env.EVIDENCES_BUCKET;
  if (!bucket) throw new Error('EVIDENCES_BUCKET no configurado');

  const validationError = validateEvidenceUploadInput(input);
  if (validationError) return badRequest(validationError);

  const rawFileName = input.fileName!.trim();
  const contentType = input.contentType!.trim();

  const safeFileName = sanitizeFileName(rawFileName);
  if (!safeFileName) return badRequest('fileName inválido');

  const folder = sanitizeFolder(input.folder);
  const fileKey = `${folder}/${Date.now()}-${safeFileName}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: EXPIRES_IN_SECONDS });

  return ok({
    fileKey,
    uploadUrl,
    expiresIn: EXPIRES_IN_SECONDS,
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
  });
});
