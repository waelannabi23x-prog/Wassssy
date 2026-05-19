module.exports = {
  apps: [{
    name: 'study-bot',
    script: 'index.js',
    instances: process.env.WEB_CONCURRENCY || 'max',
    exec_mode: 'cluster',
    max_memory_restart: '400M',
    node_args: '--max-old-space-size=400 --expose-gc',
    env: { NODE_ENV: 'production' },
    // إعادة تشغيل تلقائي إذا تعطل
    autorestart: true,
    watch: false,
    exp_backoff_restart_delay: 2000,
    // logs
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-err.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
