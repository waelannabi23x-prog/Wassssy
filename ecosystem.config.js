module.exports = {
  apps: [{
    name: 'study-bot',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '400M',
    node_args: '--max-old-space-size=400 --expose-gc',
    env: { NODE_ENV: 'production' },
    autorestart: true,
    watch: false,
    exp_backoff_restart_delay: 2000,
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-err.log',
    merge_logs: true
  }]
};
