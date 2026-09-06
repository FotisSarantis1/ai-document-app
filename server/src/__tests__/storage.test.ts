const put = jest.fn();
const del = jest.fn();

jest.mock("@vercel/blob", () => ({ put, del }));

describe("storage.ts - Vercel Blob mode", () => {
  const ORIGINAL_ENV = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    jest.resetModules();
    put.mockReset();
    del.mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
  });

  afterAll(() => {
    process.env.BLOB_READ_WRITE_TOKEN = ORIGINAL_ENV;
  });

  it("saves with access: 'private' - a store provisioned as private rejects 'public' outright", async () => {
    put.mockResolvedValue({ url: "https://example-blob.vercel-storage.com/user1/file.pdf" });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { saveFile } = require("../services/storage");
    await saveFile("user1", "file.pdf", Buffer.from("pdf bytes"));

    expect(put).toHaveBeenCalledWith(
      "user1/file.pdf",
      expect.any(Buffer),
      expect.objectContaining({ access: "private" })
    );
  });

  it("reads a Blob URL with the store token in the Authorization header", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("pdf bytes").buffer,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFile } = require("../services/storage");
    await readFile("https://example-blob.vercel-storage.com/user1/file.pdf");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example-blob.vercel-storage.com/user1/file.pdf",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-blob-token" }),
      })
    );
  });

  it("deletes a Blob URL via the SDK", async () => {
    del.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { deleteFile } = require("../services/storage");
    await deleteFile("https://example-blob.vercel-storage.com/user1/file.pdf");

    expect(del).toHaveBeenCalledWith("https://example-blob.vercel-storage.com/user1/file.pdf");
  });
});
