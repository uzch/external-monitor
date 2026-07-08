import { describe, expect, it } from "vitest";
import { validatePublicHttpUrl } from "../../server/sourceSafety";

describe("source URL safety", () => {
  it("rejects non-http retrieval methods", async () => {
    await expect(validatePublicHttpUrl("file:///etc/passwd")).rejects.toThrow(/http or https/);
  });

  it("rejects localhost targets", async () => {
    await expect(validatePublicHttpUrl("http://localhost/feed.xml")).rejects.toThrow(/localhost/);
  });

  it("rejects private literal addresses", async () => {
    await expect(validatePublicHttpUrl("http://192.168.1.10/feed.xml")).rejects.toThrow(/private/);
  });
});
