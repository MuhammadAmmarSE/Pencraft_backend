// PM2 ecosystem file
// Controls both backend (NestJS) and frontend (Next.js) processes
// Usage: pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    // ─── Backend — NestJS API ─────────────────────────────────────────────
    {
      name: 'copyai-api',
      cwd: '/',
      script: 'dist/main.js',
      instances: 2,             // 2 processes — uses both t3.micro vCPUs
      exec_mode: 'cluster',     // Cluster mode for zero-downtime restarts
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 8023,
      },
      // Logging
      out_file: '/var/log/copyai/api.out.log',
      error_file: '/var/log/copyai/api.err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // Restart behaviour
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      // Health check
      listen_timeout: 8000,
      kill_timeout: 5000,
      // Graceful shutdown
      shutdown_with_message: true,
      wait_ready: true,
    },

    // // ─── Frontend — Next.js ───────────────────────────────────────────────
    // {
    //   name: 'copyai-web',
    //   cwd: '/var/www/copyai/frontend',
    //   script: 'node_modules/.bin/next',
    //   args: 'start -p 3000',
    //   instances: 1,             // Next.js handles concurrency internally
    //   exec_mode: 'fork',
    //   max_memory_restart: '512M',
    //   env_production: {
    //     NODE_ENV: 'production',
    //     PORT: 3000,
    //   },
    //   out_file: '/var/log/copyai/web.out.log',
    //   error_file: '/var/log/copyai/web.err.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss',
    //   merge_logs: true,
    //   autorestart: true,
    //   restart_delay: 3000,
    //   max_restarts: 10,
    // },
  ],
};
