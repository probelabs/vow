#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

function getRepoRoot() {
  try {
    const out = execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (out) return out;
  } catch (_) {}
  return process.cwd();
}

function getVowContent() {
  const repo = getRepoRoot();
  // Support both old AGENT_CONSENT.md and new AGENT_VOW.md
  const vowFiles = ['AGENT_VOW.md', 'AGENT_CONSENT.md'];
  
  // First check for local vow files
  for (const file of vowFiles) {
    const filePath = path.join(repo, file);
    if (fs.existsSync(filePath)) {
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch (e) {
        return null;
      }
    }
  }
  
  // If no local vow file, use default from package
  const defaultVowPath = path.join(__dirname, '..', 'templates', 'default.md');
  if (fs.existsSync(defaultVowPath)) {
    try {
      return fs.readFileSync(defaultVowPath, 'utf8');
    } catch (e) {
      return null;
    }
  }
  
  return null;
}

function checkVow() {
  const repo = getRepoRoot();
  const consentFile = path.join(repo, '.AGENT_CONSENT');
  
  // Get vow content (either local or default)
  const vowContent = getVowContent();
  
  if (!vowContent) {
    // No vow content available, exit successfully
    return 0;
  }
  
  const consentExists = fs.existsSync(consentFile);
  if (!consentExists) {
    process.stderr.write(vowContent + '\n');
    return 1;
  }
  
  // Clean up consent file
  try {
    if (fs.existsSync(consentFile)) {
      fs.unlinkSync(consentFile);
    }
  } catch (_) {}
  
  return 0;
}

function showRules() {
  const vowContent = getVowContent();
  
  if (!vowContent) {
    console.error('No vow rules found (neither local nor default)');
    return 1;
  }
  
  console.log(vowContent);
  return 0;
}

function showHelp() {
  console.log(`
🤝 Vow - AI Accountability Gate

Usage:
  vow                  Interactive installation wizard (default)
  vow check            Check if AI has taken the vow
  vow install          Interactive installation wizard
  vow rules            Display current vow rules
  vow --help           Show this help message
  vow --version        Show version

Commands:
  check                Check accountability and require consent
  install              Set up Vow in your project (same as default)
                       Use 'vow install --help' for installation options
  rules                Show the current vow rules being used
                       (local AGENT_VOW.md or default)

Options:
  -h, --help          Show help
  -v, --version       Show version

Examples:
  # Install interactively (default behavior)
  vow

  # Check vow accountability
  vow check

  # Install non-interactively
  vow install --yes
  
  # View current rules
  vow rules

For more information, visit: https://probelabs.com/vow
`);
}

function showVersion() {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    console.log(`v${pkg.version}`);
  } catch (e) {
    console.log('unknown');
  }
}

function main() {
  const args = process.argv.slice(2);
  
  // Check for help or version flags
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
  }
  
  // Check for explicit check command
  if (args[0] === 'check') {
    const exitCode = checkVow();
    process.exit(exitCode);
  }
  
  // Check for install command
  if (args[0] === 'install') {
    // Run the install script
    const installScript = path.join(__dirname, 'vow-install.js');
    const installArgs = args.slice(1);
    
    const child = spawn('node', [installScript, ...installArgs], {
      stdio: 'inherit'
    });
    
    child.on('exit', (code) => {
      process.exit(code || 0);
    });
    
    return;
  }
  
  // Check for rules command
  if (args[0] === 'rules') {
    const exitCode = showRules();
    process.exit(exitCode);
  }
  
  // Default behavior: run install (interactive installation)
  const installScript = path.join(__dirname, 'vow-install.js');
  
  const child = spawn('node', [installScript, ...args], {
    stdio: 'inherit'
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main();
