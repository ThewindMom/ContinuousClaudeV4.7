#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CONTEXT_THRESHOLD = 85;

function getSessionId(data) {
  const sid = data.session_id || '';
  if (sid) return sid.slice(0, 8);
  return process.env.FACTORY_SESSION_ID || String(process.ppid);
}

function main() {
  const data = JSON.parse(readFileSync(0, 'utf-8'));

  if (data.stop_hook_active) {
    console.log('{}');
    return;
  }

  const sid = getSessionId(data);
  const file = join(tmpdir(), `factory-context-pct-${sid}.txt`);
  let pct = null;
  try {
    if (existsSync(file)) pct = parseInt(readFileSync(file, 'utf-8').trim(), 10);
  } catch {}

  if (pct == null || pct < CONTEXT_THRESHOLD) {
    console.log('{}');
    return;
  }

  console.log(JSON.stringify({
    decision: 'block',
    reason: `Context at ${pct}%. Run /create-handoff before stopping.`,
  }));
}

main();
