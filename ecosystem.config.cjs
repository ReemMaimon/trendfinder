/**
 * PM2 process definitions for the Hostinger VPS deployment.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup     # persist across reboots
 *
 * Two processes:
 *   trendfinder-web    -> the Next.js server (public site + admin + API)
 *   trendfinder-worker -> the node-cron scheduler (daily 00:00 Asia/Jerusalem)
 *
 * If you prefer to drive generation purely via HTTP (Hostinger cron panel /
 * system crontab hitting /api/cron/generate), set ENABLE_INPROCESS_CRON=false
 * and you can omit the worker — but running both is harmless (generation is
 * idempotent).
 */
module.exports = {
  apps: [
    {
      name: "trendfinder-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "600M",
      env: { NODE_ENV: "production" },
      out_file: "logs/web.out.log",
      error_file: "logs/web.err.log",
      time: true,
    },
    {
      name: "trendfinder-worker",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "src/jobs/scheduler.ts",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
      env: { NODE_ENV: "production" },
      out_file: "logs/worker.out.log",
      error_file: "logs/worker.err.log",
      time: true,
    },
  ],
};
