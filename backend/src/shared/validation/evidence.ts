const CONTENT_TYPE_RE = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;

export function validateEvidenceUploadInput(input: { fileName?: string; contentType?: string }): string | null {
  if (!input.fileName?.trim()) return 'fileName requerido';
  if (!input.contentType?.trim()) return 'contentType requerido';
  if (!CONTENT_TYPE_RE.test(input.contentType.trim())) return 'contentType inválido';
  return null;
}

export function validateEvidenceDownloadInput(input: { fileKey?: string }): string | null {
  const fileKey = input.fileKey?.trim();
  if (!fileKey) return 'fileKey requerido';
  if (fileKey.includes('..') || fileKey.startsWith('/')) return 'fileKey inválido';
  return null;
}
