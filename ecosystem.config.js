module.exports = {
  apps: [{
    name: 'study-bot',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '460M',
    node_args: '--max-old-space-size=460 --optimize-for-size --expose-gc',
    env: { NODE_ENV: 'production' },
    error_file: './logs/err.log',
    out_file:   './logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    restart_delay: 5000,
    max_restarts: 15,
    autorestart: true,
    watch: false,
    kill_timeout: 8000,
    listen_timeout: 10000
  }]
};
