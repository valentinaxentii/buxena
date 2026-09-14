/** Own the test server instead of reusing a possibly live local instance. */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';

export async function startQaServer() {
  let output = '';
  const child = spawn(process.execPath, [
    path.resolve('node_modules/astro/bin/astro.mjs'), 'dev',
    '--host', '127.0.0.1', '--port', '14321', '--ignore-lock',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // Prevent Astro's agent detection from daemonizing and losing its logs.
      ASTRO_DEV_BACKGROUND: '1',
      BUXENA_SAFE_MODE: 'true',
      ENQUIRIES_DEV_LIVE: 'false',
    },
  });
  const cleanup = () => child.kill('SIGTERM');
  process.once('exit', cleanup);
  const stop = async () => {
    process.removeListener('exit', cleanup);
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const timeout = setTimeout(() => child.kill('SIGKILL'), 3000);
    try { await exited; } finally { clearTimeout(timeout); }
  };
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Test server startup timed out. ${output.slice(-1800)}`)), 30_000);
      const finish = (error, url) => {
        clearTimeout(timer);
        child.removeListener('error', failed);
        child.removeListener('exit', earlyExit);
        if (error) reject(error); else resolve(url);
      };
      const failed = (error) => finish(error);
      const earlyExit = (code) => finish(new Error(`Test server exited (${code}). ${output.slice(-1800)}`));
      const append = (chunk) => {
        output += String(chunk).replace(/\x1b\[[0-9;]*m/g, '');
        // Use the server's actual port if Vite selected the next free one.
        const ready = output.match(/Local\s+(http:\/\/127\.0\.0\.1:\d+)\//);
        if (ready) finish(null, ready[1]);
      };
      child.on('error', failed);
      child.on('exit', earlyExit);
      child.stdout.on('data', append);
      child.stderr.on('data', append);
    });
    return { base, logs: () => output, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
