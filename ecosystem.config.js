module.exports = {
  apps: [{
    name: 'photo-blog',
    script: 'pnpm',
    args: 'start',
    cwd: '/opt/exif-photo-blog',
    instances: 1,
    max_memory_restart: '512M',
    node_args: '--max-old-space-size=256',
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'production',
    },
  }],
};
