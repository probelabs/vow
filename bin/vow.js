#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getRepoRoot() {
  try {
    const out = execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (out) return out;
  } catch (_) {}
  return process.cwd();
}

function main() {
  const repo = getRepoRoot();
  const consentMd = path.join(repo, 'AGENT_CONSENT.md');
  const consentFile = path.join(repo, '.AGENT_CONSENT');
  let exitCode = 0;
  try {
    const mdExists = fs.existsSync(consentMd);
    if (!mdExists) return;
    const consentExists = fs.existsSync(consentFile);
    if (!consentExists) {
      try {
        const content = fs.readFileSync(consentMd, 'utf8');
        process.stderr.write(content + '\n');
      } catch (e) {
        process.stderr.write('AGENT_CONSENT.md missing or unreadable.\n');
      }
      exitCode = 1;
    }
  } finally {
    try {
      if (fs.existsSync(consentMd) && fs.existsSync(consentFile)) {
        fs.unlinkSync(consentFile);
      }
    } catch (_) {}
    process.exit(exitCode);
  }
}

main();
