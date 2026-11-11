import type { Api } from "grammy";

import { Elysia } from "elysia";

import { env } from "#/config/env";

const FILE_PATH_CACHE_MS = 30 * 60 * 1000;
const MAX_CACHED_FILE_PATHS = 500;
const filePathCache = new Map<string, { path: string; expiresAt: number }>();
type AvatarFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function cacheFilePath(fileId: string, path: string) {
  if (filePathCache.size >= MAX_CACHED_FILE_PATHS) {
    const oldest = filePathCache.keys().next().value;
    if (oldest) filePathCache.delete(oldest);
  }

  filePathCache.set(fileId, {
    path,
    expiresAt: Date.now() + FILE_PATH_CACHE_MS,
  });
}

async function getFilePath(api: Api, fileId: string) {
  const cached = filePathCache.get(fileId);
  if (cached && cached.expiresAt > Date.now()) return cached.path;

  const file = await api.getFile(fileId);
  if (!file.file_path) return null;

  cacheFilePath(fileId, file.file_path);
  return file.file_path;
}

function fileDownloadUrl(filePath: string) {
  const root = env.CUSTOM_API_ROOT.replace(/\/+$/, "");
  const testPath = env.TELEGRAM_TEST_SERVER ? "test/" : "";
  return `${root}/file/bot${env.BOT_TOKEN}/${testPath}${filePath}`;
}

export function createMiniAppAvatarApi(
  api: Api,
  fetcher: AvatarFetcher = fetch,
) {
  return new Elysia({ prefix: "/api" }).get(
    "/avatar/:fileId",
    async ({ params }) => {
      const fileId = params.fileId;
      if (!/^[a-zA-Z0-9_-]{8,512}$/.test(fileId)) {
        return new Response(null, { status: 404 });
      }

      try {
        const filePath = await getFilePath(api, fileId);
        if (!filePath) return new Response(null, { status: 404 });

        const image = await fetcher(fileDownloadUrl(filePath), {
          signal: AbortSignal.timeout(15_000),
        });
        const contentType = image.headers.get("content-type") ?? "";
        if (!image.ok || !image.body || !contentType.startsWith("image/")) {
          return new Response(null, { status: 404 });
        }

        return new Response(image.body, {
          headers: {
            "Cache-Control":
              "public, max-age=3600, stale-while-revalidate=86400",
            "Content-Type": contentType,
            "X-Content-Type-Options": "nosniff",
            "Cross-Origin-Resource-Policy": "cross-origin",
          },
        });
      } catch {
        return new Response(null, { status: 404 });
      }
    },
  );
}
