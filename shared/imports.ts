export const SUPPORTED_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
  ".ico"
] as const;

export const SUPPORTED_DOCUMENT_EXTENSIONS = [".pdf"] as const;

export const SUPPORTED_IMPORT_EXTENSIONS = [
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ...SUPPORTED_DOCUMENT_EXTENSIONS
] as const;

export const getImportKindFromExtension = (ext: string) => {
  const normalized = ext.toLowerCase();
  if (SUPPORTED_IMAGE_EXTENSIONS.includes(normalized as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number])) {
    return "image" as const;
  }
  if (
    SUPPORTED_DOCUMENT_EXTENSIONS.includes(
      normalized as (typeof SUPPORTED_DOCUMENT_EXTENSIONS)[number]
    )
  ) {
    return "pdf" as const;
  }
  return "file" as const;
};
