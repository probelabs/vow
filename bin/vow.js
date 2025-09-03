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

function checkVow(options = {}) {
  const { hookMode = false, hookType = null, debug = false } = options;
  const repo = getRepoRoot();
  const consentFile = path.join(repo, '.vow-consent');
  const challengeFile = path.join(repo, '.vow-challenge');
  const cooldownFile = path.join(repo, '.vow-cooldown'); // prevent immediate re-prompt loops
  const COOLDOWN_MS = parseInt(process.env.VOW_COOLDOWN_MS || '5000', 10);

  // Parse hook input (stdin) for ALL hook types when running as a hook
  let hookInput = null;
  let stdinData = '';
  if (hookMode) {
    try {
      stdinData = fs.readFileSync(0, 'utf8');
      if (stdinData && stdinData.trim()) {
        hookInput = JSON.parse(stdinData);
      }
    } catch (_) {
      // Ignore parse errors: we'll operate with defaults
    }
  }
  const isStopHook = hookType === 'Stop' || hookType === 'SubagentStop';
  const stopHookActive = !!(hookInput && hookInput.stop_hook_active === true);

  // Loop guard: If Claude is already continuing due to a Stop/SubagentStop hook,
  // DO NOT initiate a new challenge. This prevents infinite stop loops.
  if (hookMode && isStopHook && stopHookActive) {
    console.log(JSON.stringify({ continue: true }));
    return 0;
  }
  
  // Handle PreToolUseGit - filter for git commits (stdin already parsed above)
  if (hookType === 'PreToolUseGit') {
    try {
      const toolName = (hookInput && hookInput.tool_name) || '';
      const command = ((hookInput && hookInput.tool_input) || {}).command || '';

      // Debug logging
      if (debug || process.env.VOW_DEBUG) {
        const debugFile = path.join(repo, '.vow-debug.log');
        const timestamp = new Date().toISOString();
        const debugEntry = `[${timestamp}] Hook Type: ${hookType}, Hook Mode: ${hookMode}\nSTDIN: ${stdinData || '(empty)'}\n---\n`;
        
        try {
          fs.appendFileSync(debugFile, debugEntry);
        } catch (e) {
          // Ignore debug write errors
        }
      }
      
      if (toolName !== 'Bash' || !command.startsWith('git commit')) {
        // Not a git commit, allow it
        if (hookMode) {
          console.log(JSON.stringify({ continue: true }));
        }
        return 0;
      }
      
      // This is a git commit, proceed with vow check
    } catch (e) {
      // Error reading/parsing stdin, allow by default
      if (hookMode) {
        console.log(JSON.stringify({ continue: true }));
      }
      return 0;
    }
  }
  
  // Debug logging for other hook types
  if ((debug || process.env.VOW_DEBUG) && hookType !== 'PreToolUseGit') {
    const debugFile = path.join(repo, '.vow-debug.log');
    const timestamp = new Date().toISOString();
    const debugEntry = `[${timestamp}] Hook Type: ${hookType || 'none'}, Hook Mode: ${hookMode}\nSTDIN: ${stdinData || '(empty)'}\n---\n`;
    
    try {
      fs.appendFileSync(debugFile, debugEntry);
    } catch (e) {
      // Ignore debug write errors
    }
  }
  
  // Get vow content (either local or default)
  let vowContent = getVowContent();
  
  if (!vowContent) {
    // No vow content available
    if (hookMode) {
      const response = { continue: true };
      if (hookType === 'PreToolUse') {
        response.hookSpecificOutput = { permissionDecision: 'allow' };
      }
      console.log(JSON.stringify(response));
      return 0;
    }
    return 0;
  }
  
  const consentExists = fs.existsSync(consentFile);
  if (!consentExists) {
    // For Stop/SubagentStop, apply a short cooldown so our own follow-up tool calls
    // (e.g., "vow rules" or "vow check") don't trigger a fresh challenge immediately.
    if (hookMode && isStopHook) {
      let lastTs = 0;
      try {
        lastTs = parseInt(fs.readFileSync(cooldownFile, 'utf8').trim(), 10) || 0;
      } catch (_) {}
      const now = Date.now();
      if (stopHookActive || (lastTs && now - lastTs < COOLDOWN_MS)) {
        console.log(JSON.stringify({ continue: true }));
        return 0;
      }
    }

    // Generate random validation code
    const validationCode = crypto.randomInt(0, 1000);
    
    // Store validation code in challenge file
    try {
      fs.writeFileSync(challengeFile, validationCode.toString(), 'utf8');
    } catch (e) {
      // If we can't write challenge file, handle based on mode
      if (hookMode) {
        const response = { continue: true };
        if (hookType === 'PreToolUse') {
          response.hookSpecificOutput = { permissionDecision: 'allow' };
        }
        console.log(JSON.stringify(response));
        return 0;
      }
      
      const fallbackHeader = '# ⚠️ STOP - AI ACCOUNTABILITY CHECK\n\n' +
                            'Before continuing, you need to stop and evaluate yourself with the rules below:\n\n' +
                            '---\n\n';
      process.stderr.write(fallbackHeader + vowContent + '\n');
      return 1;
    }
    
    // Handle hook mode - need consent before proceeding
    if (hookMode) {
      const minimalMessage = `Stop and fully re-evaluate your last response and task against <vow-rules>. Take time for separate thinking. If you do not remember <vow-rules> word by word, or have never seen them, first read using: \`npx -y @probelabs/vow@latest rules --ai\` <vow-code>${validationCode}</vow-code>`;
      
      // For denial: Use exit code 2 + stderr (no JSON output)
      process.stderr.write(minimalMessage);
      return 2; // Exit code 2 blocks the tool call
    }
    
    // Build the complete output with header, content, and footer for non-hook mode
    const header = '# ⚠️ STOP - AI ACCOUNTABILITY CHECK\n\n' +
                   'Before continuing, you need to stop and evaluate yourself with the rules below:\n\n' +
                   '---\n\n';
    
    const footer = '\n\n---\n\n' +
                   '## CONSENT INSTRUCTIONS\n\n' +
                   'After reviewing all rules above:\n\n' +
                   '1. **Respond with ONLY**:\n' +
                   '   - "✓ All rules satisfied" if fully compliant\n' +
                   '   - List specific violations if not compliant\n\n' +
                   '2. **Provide consent**:\n' +
                   `   Create file \`${repo}/.vow-consent\` containing: \`${validationCode}\`\n\n` +
                   '3. **Retry any blocked command** (e.g., git commit)\n\n' +
                   `<vow-code>${validationCode}</vow-code>\n\n` +
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
        if (hookMode) {
          const response = { 
            continue: false, 
            stopReason: `Invalid consent code. Expected '${expectedCode}' but got '${actualCode}'` 
          };
          if (hookType === 'PreToolUse') {
            response.hookSpecificOutput = { permissionDecision: 'deny' };
          }
          console.log(JSON.stringify(response));
          // Clean up invalid consent
          fs.unlinkSync(consentFile);
          return 2;
        }
        
        process.stderr.write(`\n❌ Invalid consent code. Expected '${expectedCode}' but got '${actualCode}'\n`);
        process.stderr.write('Please review the rules again and provide the correct validation code.\n\n');
        
        // Clean up invalid consent
        fs.unlinkSync(consentFile);
        return 1;
      }
    } catch (e) {
      // Error reading files, treat as invalid
      if (hookMode) {
        const response = { 
          continue: false, 
          stopReason: 'Error validating consent' 
        };
        if (hookType === 'PreToolUse') {
          response.hookSpecificOutput = { permissionDecision: 'deny' };
        }
        console.log(JSON.stringify(response));
        return 2;
      }
      
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
    // Mark cooldown after a successful validation to avoid immediate retrigger
    if (hookMode && isStopHook) {
      try {
        fs.writeFileSync(cooldownFile, String(Date.now()), 'utf8');
      } catch (_) {}
    }
  } catch (_) {}
  
  // Consent is valid - allow action to proceed
  if (hookMode) {
    const response = { continue: true };
    if (hookType === 'PreToolUse') {
      response.hookSpecificOutput = { 
        permissionDecision: 'allow',
        hookEventName: 'PreToolUse'
      };
    }
    console.log(JSON.stringify(response));
  }
  
  return 0;
}

function showRules(aiMode = false) {
  const vowContent = getVowContent();
  
  if (!vowContent) {
    console.error('No vow rules found (neither local nor default)');
    return 1;
  }
  
  // AI mode: wrap in tags, no headers/footers
  if (aiMode) {
    console.log('<vow-rules>');
    console.log(vowContent);
    console.log('</vow-rules>');
    console.log('');
    console.log('<vow-response-rules>');
    console.log('1. **Review thoroughly**: Examine all recent changes related to the user\'s task according to <vow-rules>');
    console.log('2. **Respond concisely** with ONLY:');
    console.log('   - "✓ All rules satisfied" if fully compliant');
    console.log('   - List specific violations if not compliant, then iterate and fix them before responding to user (unless requiring user confirmation or acknowledging failure)');
    console.log('3. **Provide consent** (only if no violations):');
    console.log('   Create file `.vow-consent` containing the validation code from <vow-code> tag');
    console.log('4. **Retry any blocked command** (e.g., git commit) after providing consent');
    console.log('');
    console.log('Create file `.vow-consent` containing the validation code from <vow-code> tag if all rules satisfied.');
    console.log('⚠️ **IMPORTANT**: You can only create consent file after thorough review. If there are violations, you cannot provide consent.');
    console.log('');
    console.log('5. **Respond to user**: After providing consent, respond to the user with results of the last task, including any fixes made.');
    console.log('</vow-response-rules>');
    console.log('');
    console.log('The validation code appears in <vow-code>NUMBER</vow-code> format. Extract the NUMBER and create a file named `.vow-consent` containing only that number.');
    return 0;
  }
  
  // Regular mode: show with headers and footers
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
  vow uninstall        Remove Vow from all locations
  vow rules            Display current vow rules
  vow --help           Show this help message
  vow --version        Show version

Commands:
  check                Check accountability and require consent
  consent <code>       Write validation code to .vow-consent file
  install              Set up Vow in your project (same as default)
                       Use 'vow install --help' for installation options
  uninstall            Remove Vow from git hooks, Husky, Claude Code, etc.
                       Use 'vow uninstall --help' for options
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
    const hookMode = args.includes('--hook');
    const hookTypeArg = args.find(arg => arg.startsWith('--hook-type='));
    const hookType = hookTypeArg ? hookTypeArg.split('=')[1] : null;
    const debug = args.includes('--debug');
    
    const exitCode = checkVow({ hookMode, hookType, debug });
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
    const aiMode = args.includes('--ai');
    const exitCode = showRules(aiMode);
    process.exit(exitCode);
  }
  
  // Check for uninstall command
  if (args[0] === 'uninstall') {
    // Run the install script with --uninstall flag
    const installScript = path.join(__dirname, 'vow-install.js');
    const uninstallArgs = ['--uninstall', ...args.slice(1)];
    
    const child = spawn('node', [installScript, ...uninstallArgs], {
      stdio: 'inherit'
    });
    
    child.on('exit', (code) => {
      process.exit(code || 0);
    });
    
    return;
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
