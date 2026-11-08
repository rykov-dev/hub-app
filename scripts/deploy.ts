#!/usr/bin/env bun
// Release a new version: `bun run deploy [patch|minor|major|X.Y.Z] [--yes]`.
// (`bun deploy` without `run` is a subcommand reserved by Bun.)
//
//   1. Checks: on `dev`, clean tree, in sync with origin; typecheck + build.
//   2. Bumps "version" in package.json, commits "chore: release vX.Y.Z" to dev.
//   3. Merges dev into main (prod), checks typecheck + build there.
//   4. Applies Supabase migrations and deploys edge functions to production.
//   5. Pushes dev, main and the vX.Y.Z tag; the tag deploys the frontend
//      (.github/workflows/deploy.yml).
//
// Nothing is pushed or deployed before the confirmation (skip it with --yes).
// Ends on dev again.
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
process.chdir(root);

const args = process.argv.slice(2);
const yes = args.includes('--yes') || args.includes('-y');
const bump = args.find((a) => !a.startsWith('-')) ?? 'patch';

// Undoes local release steps (version commit, merge, tag) until something
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
if (git('branch', '--show-current').text !== 'dev') fail('Выпуск делается из ветки dev.');
if (git('status', '--porcelain').text) fail('Есть незакоммиченные изменения.');
sh(['git', 'fetch', '--quiet', '--tags', 'origin'], 'git fetch');
for (const branch of ['dev', 'main']) {
  if (git('rev-list', '--count', `${branch}..origin/${branch}`).text !== '0') {
    fail(`Локальная ${branch} отстаёт от origin/${branch}: сделай git pull.`);
  }
}

const current = (await readPkg()).version as string;
const version = nextVersion(current);
const tag = `v${version}`;
if (git('rev-parse', '-q', '--verify', `refs/tags/${tag}`).ok) fail(`Тег ${tag} уже есть.`);

const pending = git('log', '--oneline', 'main..dev').text;
console.log(`Версия: ${current} → ${version}`);
console.log(pending ? `Попадёт в main:\n${pending}` : 'Новых коммитов в dev нет (выйдет только смена версии).');

check();

// 2. Version commit on dev
step(`Коммит версии ${version} в dev`);
const devHead = git('rev-parse', 'dev').text;
const mainHead = git('rev-parse', 'main').text;
await setVersion(version);
rollback = () => {
  git('merge', '--abort');
  git('tag', '-d', tag);
  git('switch', '--quiet', '--force', 'dev');
  git('branch', '--force', 'main', mainHead);
  git('reset', '--quiet', '--hard', devHead);
};
sh(['git', 'commit', '--quiet', '-am', `chore: release ${tag}`]);

// 3. Merge into main
step('Merge dev → main');
sh(['git', 'switch', '--quiet', 'main']);
if (!git('merge', '--no-edit', '--no-ff', '-m', `Merge dev for ${tag}`, 'dev').ok) {
  const conflicts = git('diff', '--name-only', '--diff-filter=U').text.split('\n').filter(Boolean);
  // main keeps its own package name and README; only the version comes from dev.
  const own = new Set(['package.json', 'README.md']);
  if (conflicts.length > 0 && conflicts.every((f) => own.has(f))) {
    sh(['git', 'checkout', '--ours', ...conflicts]);
    await setVersion(version);
    sh(['git', 'add', ...conflicts, 'package.json']);
    sh(['git', 'commit', '--quiet', '--no-edit']);
  } else {
    fail(
      `Конфликт при merge в main: ${conflicts.join(', ')}.\n` +
        '  Сделай merge dev → main вручную (разделы хаба в main не возвращать), запушь main и запусти снова.',
    );
  }
}
check();
sh(['git', 'tag', '-a', tag, '-m', tag]);

// 4–5. Point of no return
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
confirm(`Выпустить ${tag}: миграции и функции в production, push dev/main/${tag}?`);

rollback = null;
step('Supabase: миграции и edge functions');
sh(['bunx', 'supabase', 'db', 'push', '--linked', '--yes']);
sh(['bunx', 'supabase', 'functions', 'deploy', '--use-api']);

step('Push');
sh(['git', 'push', '--quiet', 'origin', 'dev', 'main']);
sh(['git', 'push', '--quiet', 'origin', tag]);
sh(['git', 'switch', '--quiet', 'dev']);

console.log(`\n✔ ${tag} выпущен. Фронтенд деплоится: https://github.com/rykov-dev/hub-app/actions`);
