#!/usr/bin/env node
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join, resolve } from 'path';

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf-8'));
  } catch {
    return {};
  }
}

function findProjectRoot(start) {
  let current = resolve(start || process.cwd());
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = resolve(current, '..');
    if (parent === current) return current;
    current = parent;
  }
}

function safeExec(command, cwd) {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 5000,
    }).trim();
  } catch {
    return '';
  }
}

function getGitSummary(cwd) {
  const output = safeExec('git --no-optional-locks status --porcelain -b', cwd);
  if (!output) return '';

  const [head = '', ...files] = output.split('\n');
  const branch = head.startsWith('## ') ? head.slice(3).split('...')[0] : '';
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;

  for (const line of files) {
    if (!line || line.length < 2) continue;
    const x = line[0];
    const y = line[1];
    if (x === '?' && y === '?') {
      untracked += 1;
      continue;
    }
    if (x !== ' ' && x !== '?') staged += 1;
    if (y !== ' ' && y !== '?') unstaged += 1;
  }

  const counts = [];
  if (staged) counts.push(`staged:${staged}`);
  if (unstaged) counts.push(`unstaged:${unstaged}`);
  if (untracked) counts.push(`untracked:${untracked}`);
  return counts.length ? `${branch} (${counts.join(', ')})` : `${branch} (clean)`;
}

function getLatestHandoff(cwd) {
  const base = join(cwd, 'thoughts', 'shared', 'handoffs');
  if (!existsSync(base)) return '';

  const files = [];
  const visit = (dir) => {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          visit(fullPath);
        } else if (
          entry.name.endsWith('.md') ||
          entry.name.endsWith('.yaml') ||
          entry.name.endsWith('.yml')
        ) {
          files.push(fullPath);
        }
      }
    } catch {}
  };

  visit(base);
  if (!files.length) return '';
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const latest = files[0];
  return latest.startsWith(`${cwd}/`) ? latest.slice(cwd.length + 1) : latest;
}

function toolStatus(command, label = command) {
  return safeExec(`command -v ${command}`, process.cwd()) ? label : null;
}

function getOptionalTools() {
  return [
    toolStatus('tldr'),
    toolStatus('rtk'),
    toolStatus('ouros'),
    toolStatus('bloks'),
    toolStatus('fastedit-hook', 'fastedit-hook'),
  ].filter(Boolean);
}

function configureSessionEnv(cwd) {
  const envFile = process.env.DROID_ENV_FILE;
  if (!envFile) return [];

  const updates = [];
  const nodeBin = join(cwd, 'node_modules', '.bin');
  if (existsSync(nodeBin)) {
    appendFileSync(envFile, `export PATH="${nodeBin}:$PATH"\n`);
    updates.push('node_modules/.bin added to PATH');
  }

  const activatePaths = [
    join(cwd, '.venv', 'bin', 'activate'),
    join(cwd, 'venv', 'bin', 'activate'),
  ];
  const activatePath = activatePaths.find((candidate) => existsSync(candidate));
  if (activatePath) {
    appendFileSync(envFile, `source "${activatePath}"\n`);
    updates.push(
      activatePath.startsWith(`${cwd}/.venv`)
        ? '.venv activated for Execute'
        : 'venv activated for Execute',
    );
  }

  return updates;
}

function buildContext(source, cwd, envUpdates) {
  const git = getGitSummary(cwd);
  const tools = getOptionalTools();
  const handoff = getLatestHandoff(cwd);

  const lines = [
    '## Continuous Claude session context',
    `- Session source: ${source}`,
    `- Git: ${git || 'not a git worktree'}`,
    `- Optional toolchain on PATH: ${tools.length ? tools.join(', ') : 'none detected'}`,
    `- Latest handoff: ${handoff || 'none found'}`,
    `- Workflow entrypoints stay explicit slash commands: /bootup, /autonomous, /autonomous-research, /research, /premortem, /review, /create-handoff, /resume-handoff, /upgrade-harness`,
  ];

  if (envUpdates.length) {
    lines.push(`- Session env prepared: ${envUpdates.join('; ')}`);
  }

  return lines.join('\n');
}

function main() {
  const input = readInput();
  const source = input.source || 'startup';
  if (!['startup', 'resume', 'clear', 'compact'].includes(source)) return;

  const cwd = findProjectRoot(input.cwd || process.env.FACTORY_PROJECT_DIR || process.cwd());
  const envUpdates = configureSessionEnv(cwd);
  const additionalContext = buildContext(source, cwd, envUpdates);

  process.stdout.write(
    JSON.stringify({
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext,
      },
    }),
  );
}

main();
