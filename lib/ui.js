#!/usr/bin/env node
'use strict';

const prompts = require('prompts');
const chalk = require('chalk');
const ora = require('ora');

/**
 * Display detection results
 */
function displayDetection(detection) {
  console.log('\nDetection Results:');
  
  // Git info
  if (detection.git.isWorktree) {
    console.log('  - Git worktree (main: ' + detection.git.worktreeInfo.mainRepo + ')');
  } else if (detection.git.isRepo) {
    console.log('  - Git repository');
  } else {
    console.log('  - Not a git repository');
    return;
  }
  
  // Hook managers
  const detected = [];
  if (detection.husky.detected) {
    detected.push(`Husky ${detection.husky.version}`);
  }
  if (detection.preCommit.detected) {
    detected.push('pre-commit framework');
  }
  if (detection.lefthook.detected) {
    detected.push('Lefthook');
  }
  if (detection.simpleGitHooks.detected) {
    detected.push('simple-git-hooks');
  }
  if (detection.claudeCode.detected) {
    detected.push('Claude Code');
  }
  if (detection.cursor.detected) {
    detected.push('Cursor AI');
  }
  
  if (detected.length > 0) {
    console.log('  - Found: ' + detected.join(', '));
  }
  
  // Warnings
  if (detection.git.hooksPath?.isCustom) {
    console.log('  - Custom hooks directory: ' + detection.git.hooksPath.path);
  }
  
  if (detection.gitHooks.hasVowInstalled) {
    console.log('  - Vow already installed in some hooks');
  }
  
  console.log('');
}

/**
 * Get installation choices based on detection
 */
function getInstallChoices(detection, recommendations) {
  const choices = [];
  
  // Install All option (recommended)
  const availableTargets = [];
  if (detection.git.isRepo && !detection.gitHooks.hasVowInstalled) {
    availableTargets.push('git hooks');
  }
  if (detection.husky.detected && !detection.husky.hasPreCommit) {
    availableTargets.push('Husky');
  }
  if (detection.claudeCode.detected && !detection.claudeCode.hasGitHook) {
    availableTargets.push('Claude Code');
  }
  
  if (availableTargets.length > 1) {
    choices.push({
      title: 'Install everywhere (recommended)',
      value: 'all',
      description: 'Install to: ' + availableTargets.join(', ')
    });
  }
  
  // Individual options
  if (detection.git.isRepo) {
    if (detection.gitHooks.hasVowInstalled) {
      choices.push({
        title: 'Git hooks (already installed)',
        value: 'git-status',
        disabled: true
      });
    } else {
      choices.push({
        title: 'Git hooks only',
        value: 'git',
        description: detection.git.hooksPath?.isCustom ? 'Custom hooks directory' : 'Standard git hooks'
      });
    }
  }
  
  if (detection.husky.detected) {
    if (detection.husky.hasPreCommit && detection.gitHooks.hooks['pre-commit']?.hasVow) {
      choices.push({
        title: `Husky ${detection.husky.version} (already installed)`,
        value: 'husky-status',
        disabled: true
      });
    } else {
      choices.push({
        title: `Husky ${detection.husky.version} only`,
        value: 'husky',
        description: 'Add to Husky pre-commit hook'
      });
    }
  }
  
  if (detection.claudeCode.detected) {
    if (detection.claudeCode.hasGitHook) {
      choices.push({
        title: 'Claude Code (already configured)',
        value: 'claude-status',
        disabled: true
      });
    } else {
      choices.push({
        title: 'Claude Code only',
        value: 'claude',
        description: 'Configure .claude settings'
      });
    }
  } else {
    choices.push({
      title: 'Claude Code only',
      value: 'claude',
      description: 'Create .claude settings'
    });
  }
  
  // Other options
  choices.push({
    title: 'Manual installation',
    value: 'manual',
    description: 'Show copy-paste commands'
  });
  
  return choices;
}

/**
 * Interactive installation prompt
 */
async function promptInstallation(detection, recommendations) {
  displayDetection(detection);
  
  // Get available choices
  const choices = getInstallChoices(detection, recommendations);
  
  // If no valid choices, show error
  if (choices.length === 0) {
    console.log('No valid installation targets found.');
    return null;
  }
  
  // Show recommendations if any warnings
  const warnings = recommendations.filter(r => r.type === 'warning');
  if (warnings.length > 0) {
    console.log('Notes:');
    warnings.forEach(rec => {
      console.log(`  - ${rec.message}`);
    });
    console.log('');
  }
  
  // Simple select prompt
  const response = await prompts({
    type: 'select',
    name: 'choice',
    message: 'Where would you like to install Vow?',
    choices: choices
  });
  
  if (!response.choice) {
    return null;
  }
  
  // Handle special cases
  if (response.choice === 'manual') {
    return { targets: ['manual'] };
  }
  
  // Convert choice to targets array
  let targets = [];
  if (response.choice === 'all') {
    // Install to all available targets
    if (detection.git.isRepo && !detection.gitHooks.hasVowInstalled) {
      targets.push('git');
    }
    if (detection.husky.detected && !detection.husky.hasPreCommit) {
      targets.push('husky');
    }
    if (detection.claudeCode.detected && !detection.claudeCode.hasGitHook) {
      targets.push('claude');
    }
    if (!detection.claudeCode.detected) {
      targets.push('claude'); // Always offer Claude Code
    }
  } else {
    targets = [response.choice];
  }
  
  // Additional options for special cases
  let scope = 'local';
  let claudeScope = 'local';
  
  // Worktree scope selection
  if (detection.git.isWorktree && targets.includes('git')) {
    const scopeResponse = await prompts({
      type: 'select',
      name: 'scope',
      message: 'Git hooks scope:',
      choices: [
        { title: 'This worktree only', value: 'worktree' },
        { title: 'All worktrees (main repository)', value: 'main' }
      ],
      initial: 0
    });
    scope = scopeResponse.scope || 'worktree';
  }
  
  // Claude Code scope selection
  if (targets.includes('claude')) {
    const claudeScopeResponse = await prompts({
      type: 'select',
      name: 'claudeScope',
      message: 'Claude Code scope:',
      choices: [
        { title: 'Local (settings.local.json)', value: 'local' },
        { title: 'Project (settings.json)', value: 'project' }
      ],
      initial: 0
    });
    claudeScope = claudeScopeResponse.claudeScope || 'local';
  }
  
  return {
    targets: targets,
    scope: scope,
    claudeScope: claudeScope
  };
}

/**
 * Non-interactive mode selection
 */
function getNonInteractiveTargets(detection, options = {}) {
  const targets = [];
  
  if (options.git || options.all) {
    targets.push('git');
  }
  
  if ((options.husky || options.all) && detection.husky.detected) {
    targets.push('husky');
  }
  
  if ((options.claude || options.all) && detection.claudeCode.detected) {
    targets.push('claude');
  }
  
  if (options.global) {
    targets.push('global');
  }
  
  // Default: install where recommended
  if (targets.length === 0 && options.yes) {
    if (detection.husky.detected) {
      targets.push('husky');
    } else if (detection.git.isRepo) {
      targets.push('git');
    }
    
    if (detection.claudeCode.detected) {
      targets.push('claude');
    }
  }
  
  return targets;
}

/**
 * Show installation results
 */
function displayResults(results) {
  console.log('\nInstallation Results:');
  
  let hasErrors = false;
  
  results.forEach(result => {
    if (result.success) {
      if (result.alreadyInstalled) {
        console.log(`  - ${result.type}: Already installed`);
      } else {
        let message = `  - ${result.type}: Successfully installed`;
        if (result.scope && result.type === 'Claude Code') {
          message += ` (${result.scope} scope)`;
        }
        console.log(message);
        if (result.path) {
          console.log(`    File: ${result.path}`);
        }
      }
    } else {
      hasErrors = true;
      console.log(`  - ${result.type}: Failed - ${result.error}`);
    }
  });
  
  console.log('');
  
  if (!hasErrors) {
    console.log('Installation complete! Vow will now check accountability before commits.');
  } else {
    console.log('Installation completed with some errors.');
  }
  
  // Show next steps
  console.log('\nNext steps:');
  console.log('  1. Test: git commit --allow-empty -m "test"');
  console.log('  2. (Optional) Create custom AGENT_VOW.md for project-specific rules');
  console.log('  3. Help: npx @probelabs/vow --help');
  console.log('');
}

/**
 * Progress spinner
 */
function createSpinner(text) {
  return ora({
    text: text,
    spinner: 'dots'
  });
}

/**
 * Display dry run results
 */
function displayDryRun(results) {
  console.log('\nDRY RUN - No changes made:');
  
  results.forEach(result => {
    console.log(`  - Would install to: ${result.type}`);
    if (result.wouldWrite) {
      console.log(`    File: ${result.wouldWrite}`);
    }
  });
  
  console.log('');
}

/**
 * Display manual installation instructions
 */
function displayManualInstructions(detection) {
  console.log('\nManual Installation Instructions:');
  console.log('');
  
  console.log('Git Hooks:');
  console.log('  # Add this one-liner to your existing pre-commit hook:');
  console.log('  npx @probelabs/vow check || exit 1');
  console.log('');
  
  if (detection.husky.detected) {
    console.log('Husky:');
    console.log('  # Create/update Husky pre-commit hook:');
    console.log("  echo '#!/bin/sh\\nnpx @probelabs/vow check' > .husky/pre-commit");
    console.log('  chmod +x .husky/pre-commit');
    console.log('');
  }
  
  if (detection.claudeCode.detected) {
    console.log('Claude Code:');
    console.log('  # Add to .claude/settings.local.json:');
    console.log('  {');
    console.log('    "gitCommitHook": "npx @probelabs/vow check"');
    console.log('  }');
    console.log('');
  }
  
  console.log('Optional - Create custom AGENT_VOW.md:');
  console.log('  # Download default rules as starting point:');
  console.log('  npx @probelabs/vow rules > AGENT_VOW.md');
  console.log('  # Then customize the rules for your project');
  console.log('');
  
  console.log('Tip: Use "npx @probelabs/vow install" for automatic setup');
  console.log('');
}

module.exports = {
  displayDetection,
  getInstallChoices,
  promptInstallation,
  getNonInteractiveTargets,
  displayResults,
  createSpinner,
  displayDryRun,
  displayManualInstructions
};