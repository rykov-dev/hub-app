#!/usr/bin/env bun
// Local development environment: `bun dev`.
//
// 1. Starts local Supabase in Docker (if it isn't running) with all migrations.
// 2. Writes its URL and publishable key to .env.local, so the app never talks
//    to the production project in dev.
// 3. Runs the edge functions, the Rsbuild dev server and, if it is installed
//    next to this repo, the local Bonsai model for the chat.
//
// Ctrl+C stops the processes; Supabase keeps running (`bun run db:stop`).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
process.chdir(root);

const fail = (message: string): never => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};

const run = (cmd: string[], quiet = false) =>
  Bun.spawnSync(cmd, { stdout: quiet ? 'pipe' : 'inherit', stderr: quiet ? 'pipe' : 'inherit' });

// Supabase CLI from node_modules, same version for everyone.
const supabase = ['bunx', 'supabase'];

if (run(['docker', 'info'], true).exitCode !== 0) {
  fail('Docker не запущен: он нужен для локального Supabase.');
}

const status = () => {
  const out = run([...supabase, 'status', '-o', 'env'], true);
  if (out.exitCode !== 0) return null;
  const env: Record<string, string> = {};
  for (const line of out.stdout.toString().split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env.API_URL ? env : null;
};

let env = status();
if (!env) {
  console.log('▶ Запускаю локальный Supabase (первый раз скачиваются образы, это долго)…');
  if (run([...supabase, 'start']).exitCode !== 0) {
    fail(
      'Supabase не запустился. Если порт занят другим проектом, останови его: `supabase stop --project-id <id>`.',
    );
  }
  env = status() ?? fail('Supabase запущен, но `supabase status` не отдаёт адрес API.');
}

// Newer CLIs print the publishable key; older ones only the anon key.
const key = env.PUBLISHABLE_KEY || env.ANON_KEY || fail('Нет publishable/anon key локального Supabase.');
await Bun.write(
  '.env.local',
  `# Local Supabase (written by scripts/dev.ts).\nPUBLIC_SUPABASE_URL=${env.API_URL}\nPUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\n`,
);
console.log(`✔ Supabase: ${env.API_URL}  ·  Studio: ${env.STUDIO_URL ?? 'http://127.0.0.1:54323'}`);
console.log(`✔ Почта (Mailpit): ${env.INBUCKET_URL ?? env.MAILPIT_URL ?? 'http://127.0.0.1:54324'}`);

type Proc = { name: string; cmd: string[] };
const procs: Proc[] = [
  { name: 'functions', cmd: [...supabase, 'functions', 'serve'] },
  { name: 'web', cmd: ['bunx', 'rsbuild', 'dev'] },
];

const bonsaiDir = process.env.BONSAI_DIR ?? join(root, '..', 'bonsai');
if (existsSync(join(bonsaiDir, 'bin', 'llama-server'))) {
  procs.push({ name: 'bonsai', cmd: ['scripts/bonsai.sh'] });
} else {
  console.log(`ℹ Bonsai не найден в ${bonsaiDir}: чат будет без модели.`);
}

const colors = ['\x1b[36m', '\x1b[35m', '\x1b[33m'];
const width = Math.max(...procs.map((p) => p.name.length));

const pipe = async (stream: ReadableStream<Uint8Array>, prefix: string) => {
  const decoder = new TextDecoder();
  let rest = '';
  for await (const chunk of stream) {
    const lines = (rest + decoder.decode(chunk, { stream: true })).split('\n');
    rest = lines.pop() ?? '';
    for (const line of lines) console.log(prefix + line);
  }
  if (rest) console.log(prefix + rest);
};

const children = procs.map((p, i) => {
  const prefix = `${colors[i % colors.length]}${p.name.padEnd(width)} │\x1b[0m `;
  const child = Bun.spawn(p.cmd, { stdout: 'pipe', stderr: 'pipe', env: process.env });
  pipe(child.stdout, prefix);
  pipe(child.stderr, prefix);
  return { ...p, child };
});

let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 500);
};
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

// One process dying (e.g. a port in use) takes the rest down instead of
// leaving a half-working environment.
const first = await Promise.race(children.map(async (c) => ({ c, code: await c.child.exited })));
if (!stopping) {
  console.error(`\n✖ ${first.c.name} завершился (код ${first.code}), останавливаю остальное.`);
  stop(first.code || 1);
}
