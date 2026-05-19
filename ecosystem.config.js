module.exports = {
  apps: [{
    name: 'study-bot',
    script: 'index.js',
    instances: process.env.WEB_CONCURRENCY || 2,
    exec_mode: 'cluster',
    max_memory_restart: '380M',
    node_args: '--max-old-space-size=380 --optimize-for-size --expose-gc',
    env: { NODE_ENV: 'production' },
    autorestart: true,
    watch: false,
    exp_backoff_restart_delay: 3000,
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-err.log',
    merge_logs: true
  }]
};
