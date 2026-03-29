import { describe, expect, it } from "vitest";
import { getImportKindFromExtension, SUPPORTED_IMAGE_EXTENSIONS } from "../shared/imports";

describe("import format support", () => {
  it("treats supported desktop image extensions as renderable image imports", () => {
    expect(SUPPORTED_IMAGE_EXTENSIONS).toEqual([
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
      ".bmp",
      ".svg",
      ".ico"
    ]);

    expect(getImportKindFromExtension(".png")).toBe("image");
    expect(getImportKindFromExtension(".jpg")).toBe("image");
    expect(getImportKindFromExtension(".jpeg")).toBe("image");
    expect(getImportKindFromExtension(".webp")).toBe("image");
    expect(getImportKindFromExtension(".gif")).toBe("image");
    expect(getImportKindFromExtension(".bmp")).toBe("image");
    expect(getImportKindFromExtension(".svg")).toBe("image");
    expect(getImportKindFromExtension(".ico")).toBe("image");
  });

  it("keeps unsupported desktop formats out of the image pipeline", () => {
    expect(getImportKindFromExtension(".tif")).toBe("file");
    expect(getImportKindFromExtension(".tiff")).toBe("file");
    expect(getImportKindFromExtension(".psd")).toBe("file");
  });
});
