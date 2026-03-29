const fileUriPrefix = "file://";

const normalizePath = (value: string) => value.replace(/\//g, "\\");

export const parseDroppedUriList = (raw: string): string[] =>
  raw
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry && !entry.startsWith("#"))
    .map((entry) => {
      if (!entry.toLowerCase().startsWith(fileUriPrefix)) return "";
      const decoded = decodeURI(entry);
      const withoutScheme = decoded.replace(/^file:\/\//i, "");
      return normalizePath(withoutScheme.replace(/^\/+([A-Za-z]:\\?)/, "$1"));
    })
    .filter(Boolean);

export const extractDroppedPaths = (
  dataTransfer: Pick<DataTransfer, "files" | "getData">,
  bridge?: (files: File[]) => string[]
): string[] => {
  const fileList = Array.from(dataTransfer.files ?? []);
  const directPaths = fileList
    .map((file) => {
      const candidate = (file as File & { path?: string; _path?: string }).path ?? (file as File & { _path?: string })._path;
      return candidate?.trim() ?? "";
    })
    .filter(Boolean);

  const bridgedPaths = bridge ? bridge(fileList).map((value) => value.trim()).filter(Boolean) : [];
  const uriPaths = parseDroppedUriList(dataTransfer.getData("text/uri-list") || "");
  const plainTextPaths = parseDroppedUriList(dataTransfer.getData("text/plain") || "");

  return [...new Set([...directPaths, ...bridgedPaths, ...uriPaths, ...plainTextPaths])];
};
