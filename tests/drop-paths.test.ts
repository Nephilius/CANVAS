import { describe, expect, it } from "vitest";
import { extractDroppedPaths, parseDroppedUriList } from "../src/features/boards/dropPaths";

describe("drop path extraction", () => {
  it("parses Explorer file URIs into Windows paths", () => {
    expect(
      parseDroppedUriList("file:///C:/Users/nephi/Pictures/ref%20one.png\r\nfile:///D:/Refs/mood.jpg")
    ).toEqual([
      "C:\\Users\\nephi\\Pictures\\ref one.png",
      "D:\\Refs\\mood.jpg"
    ]);
  });

  it("prefers all available path sources and deduplicates them", () => {
    const transfer = {
      files: [
        { path: "C:\\Refs\\direct.png" },
        { path: "" }
      ],
      getData: (type: string) =>
        type === "text/uri-list"
          ? "file:///C:/Refs/direct.png\r\nfile:///C:/Refs/extra.webp"
          : ""
    } as unknown as Pick<DataTransfer, "files" | "getData">;

    expect(
      extractDroppedPaths(transfer, () => ["C:\\Refs\\bridge.gif", "C:\\Refs\\direct.png"])
    ).toEqual([
      "C:\\Refs\\direct.png",
      "C:\\Refs\\bridge.gif",
      "C:\\Refs\\extra.webp"
    ]);
  });
});
