import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const cloudflareBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [{ binding: d1, database_name: "site-creator-d1", database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID }]
    : [],
  r2_buckets: r2
    ? [{ binding: r2, bucket_name: "site-creator-r2" }]
    : [],
};

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  ]) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }

  const plugins = [vinext(), sites()];

  // Local development is intentionally platform-neutral: no Wrangler,
  // Miniflare, D1 or R2 are required to run `npm run dev` on Windows/macOS/Linux.
  // Cloudflare remains a production-build adapter for the existing Sites host.
  if (command === "build") {
    process.env.WRANGLER_WRITE_LOGS ??= "false";
    process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
    process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
      config: cloudflareBindingConfig,
    }));
  }

  return {
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: ["terminal.local", "localhost", "127.0.0.1"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins,
  };
});
