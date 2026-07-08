import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface StaticServer {
  url: string;
  close: () => Promise<void>;
}
export async function startStaticServer(port = 4173): Promise<StaticServer> {
  const databasePath = join(mkdtempSync(join(tmpdir(), "connected-monitor-e2e-")), "e2e.sqlite");
  const child = spawn("node", ["dist-server/server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CM_PORT: String(port),
      CM_DATABASE_PATH: databasePath,
      CM_SOURCE_MIN_INTERVAL_MINUTES: "0",
      CM_SOURCE_TIMEOUT_MS: "1000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await waitForHealth(port, child);

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => close(child),
  };
}

async function waitForHealth(port: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 10000;
  let lastError = "";
  child.stderr?.on("data", (chunk) => {
    lastError += String(chunk);
  });

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Connected server exited during startup: ${lastError}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  throw new Error(`Timed out waiting for Connected server: ${lastError}`);
}

function close(child: ChildProcess): Promise<void> {
  return new Promise((resolveClose) => {
    if (child.exitCode !== null) {
      resolveClose();
      return;
    }
    child.once("exit", () => resolveClose());
    child.kill("SIGINT");
  });
}
