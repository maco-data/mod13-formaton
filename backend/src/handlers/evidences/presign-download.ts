import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAdmin } from '../../shared/middleware/auth';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { badRequest, ok } from '../../shared/utils/response';
import { validateEvidenceDownloadInput } from '../../shared/validation/evidence';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'eu-west-1' });
const EXPIRES_IN_SECONDS = 900;

type PresignDownloadInput = {
  fileKey?: string;
  downloadName?: string;
};

function sanitizeDownloadName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isValidFileKey(fileKey: string): boolean {
  if (!fileKey.trim()) return false;
  if (fileKey.includes('..')) return false;
  if (fileKey.startsWith('/')) return false;
  return true;
}

export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  if (!event.body) return badRequest('Body requerido');

  let input: PresignDownloadInput;
  try {
    input = JSON.parse(event.body);
  } catch {
    return badRequest('JSON inválido');
  }

  const bucket = process.env.EVIDENCES_BUCKET;
  if (!bucket) throw new Error('EVIDENCES_BUCKET no configurado');

  const validationError = validateEvidenceDownloadInput(input);
  if (validationError) return badRequest(validationError);

  const fileKey = input.fileKey!.trim();

  const safeDownloadName = input.downloadName?.trim()
    ? sanitizeDownloadName(input.downloadName)
    : undefined;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    ...(safeDownloadName
      ? { ResponseContentDisposition: `attachment; filename="${safeDownloadName}"` }
      : {}),
  });

  const downloadUrl = await getSignedUrl(s3, command, { expiresIn: EXPIRES_IN_SECONDS });

  return ok({
    fileKey,
    downloadUrl,
    expiresIn: EXPIRES_IN_SECONDS,
    method: 'GET',
  });
});
