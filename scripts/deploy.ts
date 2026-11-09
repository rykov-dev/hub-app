#!/usr/bin/env bun
// Release a new version: `bun run deploy [patch|minor|major|X.Y.Z] [--yes]`.
// (`bun deploy` without `run` is a subcommand reserved by Bun.)
//
// Run on `main` after the feature branch was merged into it (see
// docs/development.md); `dev` is not involved.
//
//   1. Checks: on `main`, clean tree, in sync with origin; typecheck + build.
//   2. Bumps "version" in package.json, commits "chore: release vX.Y.Z" to main
//      and tags it.
//   3. Applies Supabase migrations and deploys edge functions to production.
//   4. Pushes main and the vX.Y.Z tag; the tag deploys the frontend
//      (.github/workflows/deploy.yml).
//
// Nothing is pushed or deployed before the confirmation (skip it with --yes).
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
process.chdir(root);

const args = process.argv.slice(2);
const yes = args.includes('--yes') || args.includes('-y');
const bump = args.find((a) => !a.startsWith('-')) ?? 'patch';

// Undoes local release steps (version commit, tag) until something
// has been sent to production; after that a failure is left as it is.
let rollback: (() => void) | null = null;

const fail = (message: string): never => {
  console.error(`\n✖ ${message}`);
  if (rollback) {
    rollback();
    console.error('  Локальные изменения выпуска откачены.');
  }
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

const nextVersion = (current: string) => {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const [major, minor, patch] = current.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  return fail(`Непонятная версия «${bump}»: patch, minor, major или X.Y.Z.`);
};

const readPkg = async () => JSON.parse(await Bun.file('package.json').text());
// Keeps the file's formatting: only the version line changes.
const setVersion = async (version: string) => {
  const text = await Bun.file('package.json').text();
  await Bun.write('package.json', text.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`));
};

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
if (git('rev-list', '--count', 'main..origin/main').text !== '0') {
  fail('Локальная main отстаёт от origin/main: сделай git pull.');
}

const current = (await readPkg()).version as string;
const version = nextVersion(current);
const tag = `v${version}`;
if (git('rev-parse', '-q', '--verify', `refs/tags/${tag}`).ok) fail(`Тег ${tag} уже есть.`);

const lastTag = git('describe', '--tags', '--abbrev=0', '--match', 'v*').text;
const pending = git('log', '--oneline', '--first-parent', lastTag ? `${lastTag}..main` : 'main').text;
console.log(`Версия: ${current} → ${version}`);
console.log(
  pending
    ? `Войдёт в выпуск (с ${lastTag || 'начала'}):\n${pending}`
    : 'Новых коммитов нет (выйдет только смена версии).',
);

check();

// 2. Version commit and tag on main
step(`Коммит версии ${version} и тег ${tag}`);
const mainHead = git('rev-parse', 'main').text;
await setVersion(version);
rollback = () => {
  git('tag', '-d', tag);
  git('reset', '--quiet', '--hard', mainHead);
};
sh(['git', 'commit', '--quiet', '-am', `chore: release ${tag}`]);
sh(['git', 'tag', '-a', tag, '-m', tag]);

// 3–4. Point of no return
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
confirm(`Выпустить ${tag}: миграции и функции в production, push main/${tag}?`);

rollback = null;
step('Supabase: миграции и edge functions');
sh(['bunx', 'supabase', 'db', 'push', '--linked', '--yes']);
sh(['bunx', 'supabase', 'functions', 'deploy', '--use-api']);

step('Push');
sh(['git', 'push', '--quiet', 'origin', 'main']);
sh(['git', 'push', '--quiet', 'origin', tag]);

console.log(`\n✔ ${tag} выпущен. Фронтенд деплоится: https://github.com/rykov-dev/hub-app/actions`);
