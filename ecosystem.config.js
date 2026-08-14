module.exports = {
  apps: [{
    name: 'photo-blog',
    // Per-instance launcher: reads NODE_APP_INSTANCE (set by PM2 cluster
    // mode) and starts `next start` on port 3000+instance. PM2 official
    // cluster-mode pattern for running multiple Next.js workers.
    script: 'start-instance.js',
    cwd: '/opt/exif-photo-blog',
    instances: 2,
    exec_mode: 'cluster',
    // 2 next-server processes, each ~250-300 MB RSS. Leave headroom for
    // V8 heap growth and data cache.
    max_memory_restart: '768M',
    node_args: '--max-old-space-size=384',
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'production',
    },
  }],
};