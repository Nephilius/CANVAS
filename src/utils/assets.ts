export const toAssetUrl = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, "/");
  return encodeURI(`file:///${normalized}`);
};
