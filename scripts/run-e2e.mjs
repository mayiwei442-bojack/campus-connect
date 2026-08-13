import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const executable = (name) => resolve("node_modules", ".bin", `${name}${process.platform === "win32" ? ".cmd" : ""}`);

function readLocalSupabaseEnvironment() {
  let output;

  try {
    output = execFileSync(executable("supabase"), ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Local Supabase is not running. Run `pnpm supabase:start` and `pnpm supabase:reset` first.");
  }

  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(?:"([\s\S]*)"|(.*))$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2] ?? match[3] ?? ""]),
  );
}

const local = readLocalSupabaseEnvironment();
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY || local.ANON_KEY,
  E2E_SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY || local.SECRET_KEY,
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
};

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase status did not expose the local API and test credentials required by Playwright.");
}

const result = spawnSync(executable("playwright"), ["test", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
