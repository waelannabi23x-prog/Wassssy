module.exports = {
  apps: [{
    name: 'studybot',
    script: 'index.js',
    env_file: '.env',
    restart_delay: 3000,
    max_restarts: 10
  }]
}
