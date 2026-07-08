import { loadRuntimeConfig } from "./config.js";
import { createConnectedServer } from "./httpServer.js";
import { SqliteConnectedRepositories } from "./sqliteRepositories.js";

const config = loadRuntimeConfig();
const repositories = new SqliteConnectedRepositories(config.databasePath, config.defaultSourcePolicy);
const server = createConnectedServer(config, repositories);

server.listen(config.port, "127.0.0.1", () => {
  console.log(`Connected Monitor v1 listening on http://127.0.0.1:${config.port}`);
});

process.on("SIGINT", () => {
  server.close(() => {
    repositories.close();
    process.exit(0);
  });
});
