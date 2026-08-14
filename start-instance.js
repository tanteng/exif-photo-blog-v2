#!/usr/bin/env node
/**
 * Per-instance launcher for PM2 cluster mode.
 *
 * Why this exists
 * ---------------
 * PM2's cluster mode forks N instances, but ecosystem config can't pass
 * per-instance args — every instance would run `next start` on the same
 * port, and the second one would EADDRINUSE.
 *
 * PM2 cluster mode sets `process.env.NODE_APP_INSTANCE` to a 0-based index,
 * so this wrapper reads it and starts Next.js on
 *   port 3000 + NODE_APP_INSTANCE
 *   instance 0 → :3000
 *   instance 1 → :3001
 * and exec's the real `next start` CLI. PM2 still owns process supervision
 * (restarts, logs, max_memory_restart) — this script just routes the port.
 *
 * This is the standard "PM2 cluster + next start" pattern recommended by
 * PM2 docs for running multiple Next.js instances behind a load balancer.
 */

const { spawn } = require('child_process');
const path = require('path');

const instance = parseInt(process.env.NODE_APP_INSTANCE, 10);
if (Number.isNaN(instance)) {
  console.error(
    '[start-instance] NODE_APP_INSTANCE is not set — this wrapper must be ' +
      'launched by PM2 cluster mode, not directly.',
  );
  process.exit(1);
}

const PORT = 3000 + instance;
const nextBin = path.join(
  __dirname,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);

// eslint-disable-next-line no-console
console.log(
  `[start-instance] instance=${instance} spawning next start -p ${PORT}`,
);

const child = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(PORT) },
});

child.on('exit', (code, signal) => {
  if (signal) {
    // eslint-disable-next-line no-console
    console.log(`[start-instance] instance=${instance} next start killed by ${signal}`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(
    `[start-instance] instance=${instance} next start exited code=${code}`,
  );
  process.exit(code ?? 0);
});

// Forward termination signals to the child so next start can drain.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[start-instance] instance=${instance} received ${sig}, forwarding to child`,
    );
    child.kill(sig);
  });
}