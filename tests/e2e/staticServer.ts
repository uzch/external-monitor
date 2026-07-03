import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

export interface StaticServer {
  url: string;
  close: () => Promise<void>;
}

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export async function startStaticServer(port = 4173): Promise<StaticServer> {
  const distRoot = resolve(process.cwd(), "dist");
  const server = createServer(async (request, response) => {
    try {
      const filePath = await resolveRequestPath(distRoot, request.url ?? "/");
      const body = await readFile(filePath);

      response.writeHead(200, {
        "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  await listen(server, port);

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => close(server),
  };
}

async function resolveRequestPath(distRoot: string, requestUrl: string): Promise<string> {
  const url = new URL(requestUrl, "http://127.0.0.1");
  const relativePath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const candidate = resolve(distRoot, relativePath);
  const rootPrefix = distRoot.endsWith(sep) ? distRoot : `${distRoot}${sep}`;

  if (candidate !== distRoot && !candidate.startsWith(rootPrefix)) {
    throw new Error("Request path escapes dist root");
  }

  try {
    const stats = await stat(candidate);

    if (stats.isFile()) {
      return candidate;
    }
  } catch {
    return resolve(distRoot, "index.html");
  }

  return resolve(distRoot, "index.html");
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }

      resolveClose();
    });
  });
}
