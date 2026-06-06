import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const port = process.env.PORT ?? "3000";
const host = process.env.HOSTNAME ?? "0.0.0.0";
const root = process.cwd();

const standaloneServer = path.join(root, "server.js");

const command = process.execPath;
const args = existsSync(standaloneServer)
  ? [standaloneServer]
  : [
      path.join(root, "node_modules", "next", "dist", "bin", "next"),
      "start",
      "-H",
      host,
      "-p",
      port,
    ];

const child = spawn(command, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: host,
    PORT: port,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
