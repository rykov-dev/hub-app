#!/usr/bin/env bun
// Release the version in package.json: `bun run deploy [--yes]`.
// (`bun deploy` without `run` is a subcommand reserved by Bun.)
//
// Merges and commits nothing. The version is raised in the feature branch
// before it goes into main (see docs/development.md); run this on main after.
//
//   1. Checks: on `main`, clean tree, same as origin/main, no tag for this
//      version yet; typecheck + build.
//   2. Shows migrations missing in production and asks to confirm.
//   3. Applies the migrations and deploys edge functions to production.
//   4. Tags main's commit vX.Y.Z and pushes only the tag; the tag deploys the
//      frontend (.github/workflows/deploy.yml).
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
process.chdir(root);

const args = process.argv.slice(2);
const yes = args.includes('--yes') || args.includes('-y');

const fail = (message: string): never => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};

const step = (message: string) => console.log(`\n▶ ${message}`);

/** Runs a command with output shown; fails the release if it fails. */
const sh = (cmd: string[], what = cmd.join(' ')) => {
  const r = Bun.spawnSync(cmd, { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit' });
  if (r.exitCode !== 0) fail(`Не получилось: ${what}`);
};

/** Runs a command and returns its trimmed stdout. */
const out = (cmd: string[]) => {
  const r = Bun.spawnSync(cmd, { stdout: 'pipe', stderr: 'pipe' });
  return { ok: r.exitCode === 0, text: r.stdout.toString().trim(), err: r.stderr.toString().trim() };
};

const git = (...a: string[]) => out(['git', ...a]);

const readPkg = async () => JSON.parse(await Bun.file('package.json').text());

const confirm = (question: string) => {
  if (yes) return;
  const answer = prompt(`${question} [y/N]`);
  if (!answer || !/^y(es)?$|^д(а)?$/i.test(answer.trim())) fail('Отменено.');
};

const check = () => {
  sh(['bun', 'run', 'typecheck']);
  sh(['bun', 'run', 'build']);
};

// 1. Preconditions
step('Проверяю репозиторий');
if (git('branch', '--show-current').text !== 'main') fail('Выпуск делается из ветки main.');
if (git('status', '--porcelain').text) fail('Есть незакоммиченные изменения.');
sh(['git', 'fetch', '--quiet', '--tags', 'origin'], 'git fetch');

const version = (await readPkg()).version as string;
const tag = `v${version}`;
if (git('rev-parse', '-q', '--verify', `refs/tags/${tag}`).ok) {
  fail(`Тег ${tag} уже есть: подними version в package.json в тематической ветке до merge в main.`);
}
if (git('rev-parse', 'main').text !== git('rev-parse', 'origin/main').text) {
  fail('main не совпадает с origin/main: выпускается только то, что уже в origin/main.');
}

const lastTag = git('describe', '--tags', '--abbrev=0', '--match', 'v*').text;
const pending = git('log', '--oneline', '--first-parent', lastTag ? `${lastTag}..main` : 'main').text;
console.log(`Версия: ${tag}${lastTag ? ` (прошлая ${lastTag})` : ''}`);
console.log(pending ? `Войдёт в выпуск:\n${pending}` : 'Новых коммитов с прошлого тега нет.');

check();

// 2. Point of no return
step('Миграции, которых ещё нет в production');
// Table rows look like: `20261108020000` | `20261108020000` | `2026-11-08 02:00:00`
const list = out(['bunx', 'supabase', 'migration', 'list', '--linked', '--agent', 'no']);
const rows = list.text
  .split('\n')
  .map((line) => line.split('|').map((cell) => cell.replace(/[`\s]/g, '')))
  .filter((cells) => cells.length === 3 && /^\d*$/.test(cells[0]) && /^\d*$/.test(cells[1]))
  .filter(([local, remote]) => local || remote);
if (!list.ok || rows.length === 0) {
  fail(`Не удалось получить список миграций (supabase link сделан?):\n${list.err || list.text}`);
}
const remoteOnly = rows.filter(([local, remote]) => remote && !local).map(([, remote]) => remote);
if (remoteOnly.length) fail(`В production есть миграции, которых нет в main: ${remoteOnly.join(', ')}`);
const missing = rows.filter(([local, remote]) => local && !remote).map(([local]) => local);
console.log(missing.length ? missing.map((m) => `  • ${m}`).join('\n') : '  нет');
confirm(`Выпустить ${tag}: миграции и функции в production, тег ${tag}?`);

step('Supabase: миграции и edge functions');
sh(['bunx', 'supabase', 'db', 'push', '--linked', '--yes']);
sh(['bunx', 'supabase', 'functions', 'deploy', '--use-api']);

step(`Тег ${tag}`);
sh(['git', 'tag', '-a', tag, '-m', tag, 'main']);
sh(['git', 'push', '--quiet', 'origin', tag]);

console.log(`\n✔ ${tag} выпущен. Фронтенд деплоится: https://github.com/rykov-dev/hub-app/actions`);
