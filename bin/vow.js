#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

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
  // Use AGENT_VOW.md from the root
  const vowPath = path.join(repo, 'AGENT_VOW.md');
  
  if (fs.existsSync(vowPath)) {
    try {
      return fs.readFileSync(vowPath, 'utf8');
    } catch (e) {
      return null;
    }
  }
  
  // If no AGENT_VOW.md exists, use the built-in default from package root
  const packageVowPath = path.join(__dirname, '..', 'AGENT_VOW.md');
  if (fs.existsSync(packageVowPath)) {
    try {
      return fs.readFileSync(packageVowPath, 'utf8');
    } catch (e) {
      return null;
    }
  }
  
  return null;
}

function checkVow() {
  const repo = getRepoRoot();
  const consentFile = path.join(repo, '.vow-consent');
  const challengeFile = path.join(repo, '.vow-challenge');
  
  // Get vow content (either local or default)
  let vowContent = getVowContent();
  
  if (!vowContent) {
    // No vow content available, exit successfully
    return 0;
  }
  
  const consentExists = fs.existsSync(consentFile);
  if (!consentExists) {
    // Generate random validation code
    const validationCode = crypto.randomInt(0, 1000);
    
    // Store validation code in challenge file
    try {
      fs.writeFileSync(challengeFile, validationCode.toString(), 'utf8');
    } catch (e) {
      // If we can't write challenge file, continue without validation
      const fallbackHeader = '# ⚠️ STOP - AI ACCOUNTABILITY CHECK\n\n' +
                            'Before continuing, you need to stop and evaluate yourself with the rules below:\n\n' +
                            '---\n\n';
      process.stderr.write(fallbackHeader + vowContent + '\n');
      return 1;
    }
    
    // Build the complete output with header, content, and footer
    const header = '# ⚠️ STOP - AI ACCOUNTABILITY CHECK\n\n' +
                   'Before continuing, you need to stop and evaluate yourself with the rules below:\n\n' +
                   '---\n\n';
    
    const footer = '\n\n---\n\n' +
                   '## CONSENT INSTRUCTIONS\n\n' +
                   'If you agree with all applicable items above:\n\n' +
                   '1. **Review**: Honestly evaluate yourself against each rule\n' +
                   '2. **Acknowledge**: Inform the user that you have reviewed the rules\n' +
                   '3. **Consent**: Create a consent file with the validation code\n\n' +
                   `**VALIDATION CODE**: \`${validationCode}\`\n\n` +
                   `Create a file named \`.vow-consent\` containing exactly: \`${validationCode}\`\n\n` +
                   '⚠️ **IMPORTANT**: Never create .vow-consent in advance. Always evaluate yourself first!';
    
    const fullOutput = header + vowContent + footer;
    process.stderr.write(fullOutput);
    return 1;
  }
  
  // Validate consent file content if challenge exists
  if (fs.existsSync(challengeFile)) {
    try {
      const expectedCode = fs.readFileSync(challengeFile, 'utf8').trim();
      const actualCode = fs.readFileSync(consentFile, 'utf8').trim();
      
      if (actualCode !== expectedCode) {
        process.stderr.write(`\n❌ Invalid consent code. Expected '${expectedCode}' but got '${actualCode}'\n`);
        process.stderr.write('Please review the rules again and provide the correct validation code.\n\n');
        
        // Clean up invalid consent
        fs.unlinkSync(consentFile);
        return 1;
      }
    } catch (e) {
      // Error reading files, treat as invalid
      process.stderr.write('\n❌ Error validating consent.\n');
      return 1;
    }
  }
  
  // Clean up both files
  try {
    if (fs.existsSync(consentFile)) {
      fs.unlinkSync(consentFile);
    }
    if (fs.existsSync(challengeFile)) {
      fs.unlinkSync(challengeFile);
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
  
  // Add the same header for consistency
  const header = '# ⚠️ STOP - AI ACCOUNTABILITY CHECK\n\n' +
                 'Before continuing, you need to stop and evaluate yourself with the rules below:\n\n' +
                 '---\n\n';
  
  // For rules display, we show the format but not a specific code
  const footer = '\n\n---\n\n' +
                 '## CONSENT INSTRUCTIONS\n\n' +
                 'When these rules are displayed during a vow check:\n\n' +
                 '1. **Review**: Honestly evaluate yourself against each rule\n' +
                 '2. **Acknowledge**: Inform the user that you have reviewed the rules\n' +
                 '3. **Consent**: Create a consent file with the validation code that will be shown\n\n' +
                 '⚠️ **IMPORTANT**: A unique validation code will be generated each time';
  
  console.log(header + vowContent + footer);
  return 0;
}

function showHelp() {
  console.log(`
🤝 Vow - AI Accountability Gate

Usage:
  vow                  Interactive installation wizard (default)
  vow check            Check if AI has taken the vow
  vow consent <code>   Write validation code to consent file
  vow install          Interactive installation wizard
  vow rules            Display current vow rules
  vow --help           Show this help message
  vow --version        Show version

Commands:
  check                Check accountability and require consent
  consent <code>       Write validation code to .vow-consent file
  install              Set up Vow in your project (same as default)
                       Use 'vow install --help' for installation options
  rules                Show the current vow rules being used
                       (local AGENT_VOW.md or package default)

Options:
  -h, --help          Show help
  -v, --version       Show version

Examples:
  # Install interactively (default behavior)
  vow

  # Check vow accountability
  vow check

  # Provide consent with validation code
  vow consent 123

  # Install non-interactively
  vow install --yes
  
  # View current rules
  vow rules

For more information, visit: https://probelabs.com/vow
`);
}

function writeConsent(code) {
  if (!code) {
    console.error('Error: Validation code is required');
    console.log('Usage: vow consent <code>');
    return 1;
  }
  
  const repo = getRepoRoot();
  const consentFile = path.join(repo, '.vow-consent');
  
  try {
    fs.writeFileSync(consentFile, code.toString(), 'utf8');
    console.log(`✓ Consent provided with code: ${code}`);
    return 0;
  } catch (e) {
    console.error(`Error writing consent file: ${e.message}`);
    return 1;
  }
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
  
  // Check for consent command
  if (args[0] === 'consent') {
    const code = args[1];
    const exitCode = writeConsent(code);
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
