#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { join, resolve } from 'path';
import { tmpdir, homedir } from 'os';

function getSessionId(data) {
  const sid = data.session_id || '';
  if (sid) return sid.slice(0, 8);
  return process.env.FACTORY_SESSION_ID || String(process.ppid);
}

function getContextInfo(data) {
  const ctx = data.context_window || {};
  const usage = ctx.current_usage || {};
  const total = (usage.input_tokens || 0)
    + (usage.cache_read_input_tokens || 0)
    + (usage.cache_creation_input_tokens || 0)
    + (usage.output_tokens || 0)
    + 45000;
  const size = ctx.context_window_size || 0;
  if (!size) return null;
  const pct = Math.min(100, Math.floor(total * 100 / size));
  return { pct, display: `${(total / 1000).toFixed(1)}K` };
}

function writeContextPct(pct, data) {
  const sid = getSessionId(data);
  const tmp = tmpdir();
  const file = join(tmp, `factory-context-pct-${sid}.txt`);
  try {
    if (existsSync(file)) {
      try {
        const prev = parseInt(readFileSync(file, 'utf-8').trim(), 10);
        if (prev - pct > 10) {
          const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
          const logFile = join(homedir(), '.factory', 'logs', 'autocompact.log');
          writeFileSync(logFile, `${ts} | session:${sid} | ${prev}% -> ${pct}% (drop: ${prev - pct}%)\n`, { flag: 'a' });
        }
      } catch {}
    }
    writeFileSync(file, String(pct));
    if (Math.random() < 0.01) {
      const cutoff = Date.now() - 3600000;
      for (const f of readdirSync(tmp).filter(n => n.startsWith('factory-context-pct-'))) {
        try { if (statSync(join(tmp, f)).mtimeMs < cutoff) unlinkSync(join(tmp, f)); } catch {}
      }
    }
  } catch {}
}

function getGitInfo(cwd) {
  try {
    const out = execSync('git --no-optional-locks status --porcelain -b', {
      cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 5000,
    });
    const lines = out.split('\n');
    let branch = '';
    if (lines[0] && lines[0].startsWith('## ')) {
      branch = lines[0].slice(3).split('...')[0];
      if (branch === 'No commits yet on master' || branch === 'No commits yet on main') branch = '(init)';
      else if (branch.length > 18) branch = branch.slice(0, 16) + '..';
    }
    let staged = 0, unstaged = 0, added = 0;
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l || l.length < 2) continue;
      const x = l[0], y = l[1];
      if (x === '?' && y === '?') { added++; continue; }
      if (x !== ' ' && x !== '?') staged++;
      if (y !== ' ' && y !== '?') unstaged++;
    }
    const counts = [];
    if (staged) counts.push(`S:${staged}`);
    if (unstaged) counts.push(`U:${unstaged}`);
    if (added) counts.push(`A:${added}`);
    if (counts.length) return `${branch} ${counts.join(' ')}`;
    return branch;
  } catch { return ''; }
}

function findLatestHandoff(dir) {
  const base = join(dir, 'thoughts', 'shared', 'handoffs');
  if (!existsSync(base)) return null;
  const files = [];
  (function walk(d) {
    try {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.yaml') || e.name.endsWith('.yml') || e.name.endsWith('.md')) files.push(p);
      }
    } catch {}
  })(base);
  if (!files.length) return null;
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0];
}

function getContinuityInfo(dir) {
  let goal = '', now = '';
  const f = findLatestHandoff(dir);
  if (f) {
    try {
      const c = readFileSync(f, 'utf-8');
      const field = (name) => {
        const m = c.match(new RegExp(`^${name}:\\s*(.+?)$`, 'm'));
        return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
      };
      goal = field('goal') || field('topic');
      now = field('now');
      if (!goal) {
        const m = c.match(/^# (.+?)$/m);
        if (m) goal = m[1].replace('Handoff:', '').trim();
      }
    } catch {}
  }
  if (goal.length > 25) goal = goal.slice(0, 23) + '..';
  if (now.length > 30) now = now.slice(0, 28) + '..';
  return { goal, now };
}

function findProjectRoot(start) {
  let cur = resolve(start);
  while (true) {
    if (existsSync(join(cur, '.git'))) return cur;
    const parent = resolve(cur, '..');
    if (parent === cur) break;
    cur = parent;
  }
  return start;
}

function main() {
  let data = {};
  try { data = JSON.parse(readFileSync(0, 'utf-8')); } catch {}

  let cwd = data.cwd || process.env.FACTORY_PROJECT_DIR || process.cwd();
  if (!existsSync(join(cwd, '.git'))) cwd = findProjectRoot(cwd);

  const git = getGitInfo(cwd);
  const { goal, now } = getContinuityInfo(cwd);
  const continuity = goal && now ? `${goal} -> ${now}` : now || goal;
  const ctxInfo = getContextInfo(data);
  const parts = [];

  if (ctxInfo) {
    writeContextPct(ctxInfo.pct, data);
    parts.push(`${ctxInfo.display} ${ctxInfo.pct}%`);
  }
  if (git) parts.push(git);
  if (continuity) parts.push(continuity);

  process.stdout.write(parts.join(' | '));
}

main();
