module.exports = {
  apps: [{
    name: 'study-bot',
    script: 'index.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '400M',
    node_args: '--max-old-space-size=512',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    restart_delay: 3000,
    max_restarts: 10,
    autorestart: true,
  }]
};
