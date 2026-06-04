#!/usr/bin/env node
/**
 * 一键启动采集层 + 分析执行层（开发模式）
 * ─────────────────────────────────────────────────────────────
 * 零依赖：用 child_process 同时拉起两个进程，日志带前缀。
 *   - collector: 采集层（OpenCLI 网关，:4001）
 *   - web:       Next.js 分析执行层（:3000）
 * Ctrl+C 一并退出。
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const procs = [];

function run(name, color, cmd, args, cwd) {
  const p = spawn(cmd, args, { cwd, env: process.env, shell: false });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m`;
  const pipe = (stream, isErr) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        process[isErr ? 'stderr' : 'stdout'].write(`${prefix} ${line}\n`);
      }
    });
  };
  pipe(p.stdout, false);
  pipe(p.stderr, true);
  p.on('exit', (code) => {
    process.stdout.write(`${prefix} exited with code ${code}\n`);
    shutdown();
  });
  procs.push(p);
  return p;
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) {
    if (!p.killed) p.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('启动 OpenThemis（采集层 :4001 + 分析层 :3000）... Ctrl+C 退出\n');
// 采集层（cyan）
run('collector', '36', 'npm', ['start'], path.join(root, 'collector'));
// 分析层（green）
run('web', '32', 'npm', ['run', 'dev'], root);
