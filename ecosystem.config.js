module.exports = {
  apps: [
    // ─── Backend — NestJS API ─────────────────────────────────────────────
    {
      name: 'copyai-api',
      cwd: '/',
      script: 'dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 8023,
      },
      // Logs go to ~/.pm2/logs/ — no permission issues
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      listen_timeout: 8000,
      kill_timeout: 5000,
      shutdown_with_message: true,
      wait_ready: true,
    },

    // ─── Frontend — Next.js (uncomment when frontend is deployed) ─────────
    // {
    //   name: 'copyai-web',
    //   cwd: '/var/www/copyai/frontend',
    //   script: 'node_modules/.bin/next',
    //   args: 'start -p 3000',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   max_memory_restart: '512M',
    //   env_production: {
    //     NODE_ENV: 'production',
    //     PORT: 3000,
    //   },
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss',
    //   merge_logs: true,
    //   autorestart: true,
    //   restart_delay: 3000,
    //   max_restarts: 10,
    // },
  ],
};
