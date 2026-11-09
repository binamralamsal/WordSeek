import path from "node:path";

import { bot } from "#/config/bot";
import { env } from "#/config/env";
import { createLogger } from "#/core/logging/logger.service";

import { apiErrorResponse, handleApiRequest, isApiPath } from "./api";
import { authenticateRequest } from "./auth";

const log = createLogger("web.server");

export type MiniAppServer = ReturnType<typeof Bun.serve>;

type ServeOptions = {
  port?: number;
  staticDir?: string;
  /** Injected in tests. Defaults to the process-wide bot API. */
  api?: typeof bot.api;
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
} as const;

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...SECURITY_HEADERS,
    },
  });
}

function cacheHeaders(filePath: string): Record<string, string> {
  const normalized = filePath.replaceAll("\\", "/");

  if (normalized.includes("/assets/")) {
    return { "Cache-Control": "public, max-age=31536000, immutable" };
  }

  return { "Cache-Control": "no-cache" };
}

async function serveStatic(
  request: Request,
  pathname: string,
  staticDir: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return textResponse("Method not allowed", 405);
  }

  const root = path.resolve(staticDir);
  const requested =
    pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = path.resolve(root, requested);

  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return textResponse("Not found", 404);
  }

  const file = Bun.file(filePath);

  if (await file.exists()) {
    return new Response(request.method === "HEAD" ? null : file, {
      headers: { ...SECURITY_HEADERS, ...cacheHeaders(filePath) },
    });
  }

  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const indexPath = path.join(root, "index.html");
  const index = Bun.file(indexPath);

  if (acceptsHtml && (await index.exists())) {
    return new Response(request.method === "HEAD" ? null : index, {
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  if (pathname === "/" || acceptsHtml) {
    return new Response(
      "WordSeek Mini App is not built yet. Run `bun run build:miniapp`.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          ...SECURITY_HEADERS,
        },
      },
    );
  }

  return textResponse("Not found", 404);
}

export function createFetchHandler({
  staticDir = env.MINIAPP_STATIC_DIR,
  api = bot.api,
}: Omit<ServeOptions, "port"> = {}) {
  return async function fetchHandler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: SECURITY_HEADERS });
    }

    if (url.pathname === "/api/health") {
      return Response.json(
        { data: { ok: true, service: "wordseek-miniapp" } },
        { headers: { "Cache-Control": "no-store", ...SECURITY_HEADERS } },
      );
    }

    if (isApiPath(url.pathname)) {
      try {
        const auth = await authenticateRequest(request, api);
        const response = await handleApiRequest(request, auth);

        for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
          response.headers.set(key, value);
        }
        response.headers.set("Cache-Control", "no-store");

        return response;
      } catch (error) {
        log.warn(
          { err: error, path: url.pathname },
          "Mini App API request failed",
        );
        return apiErrorResponse(error);
      }
    }

    return await serveStatic(request, url.pathname, staticDir);
  };
}

export function startMiniAppServer(
  options: ServeOptions = {},
): MiniAppServer | null {
  try {
    const server = Bun.serve({
      port: options.port ?? env.PORT ?? env.MINIAPP_PORT,
      hostname: "0.0.0.0",
      fetch: createFetchHandler(options),
      error(error) {
        log.error({ err: error }, "Mini App server error");
        return textResponse("Internal server error", 500);
      },
    });

    log.info(
      {
        port: server.port,
        staticDir: options.staticDir ?? env.MINIAPP_STATIC_DIR,
      },
      "Mini App server started",
    );

    return server;
  } catch (error) {
    log.error({ err: error }, "Failed to start Mini App server");
    return null;
  }
}

export async function syncMiniAppMenuButton(): Promise<void> {
  if (!env.MINIAPP_URL) return;

  try {
    await bot.api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "Play WordSeek",
        web_app: { url: env.MINIAPP_URL },
      },
    });
    log.info("Mini App chat menu button configured");
  } catch (error) {
    log.warn({ err: error }, "Could not configure Mini App menu button");
  }
}
