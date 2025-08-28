#!/usr/bin/env node
'use strict';

const chalk = require('chalk');
const detector = require('../lib/detector');
const installer = require('../lib/installer');
const ui = require('../lib/ui');
const gitUtils = require('../lib/git-utils');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    help: args.includes('--help') || args.includes('-h'),
    yes: args.includes('--yes') || args.includes('-y'),
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    global: args.includes('--global'),
    git: args.includes('--git'),
    husky: args.includes('--husky'),
    claude: args.includes('--claude'),
    all: args.includes('--all'),
    uninstall: args.includes('--uninstall'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };
  
  return options;
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
${chalk.bold('🤝 Vow Installation')}

${chalk.bold('Usage:')}
  npx @probelabs/vow install [options]

${chalk.bold('Options:')}
  -h, --help       Show this help message
  -y, --yes        Non-interactive mode (auto-detect and install)
  --dry-run        Show what would be installed without making changes
  --force          Force installation even if already installed
  --global         Install globally for all git repositories
  --git            Install only git hooks
  --husky          Install only Husky hooks
  --claude         Install only Claude Code settings
  --all            Install in all detected locations
  --uninstall      Remove Vow from all locations
  -v, --verbose    Show detailed output

${chalk.bold('Examples:')}
  ${chalk.gray('# Interactive installation')}
  npx @probelabs/vow install

  ${chalk.gray('# Non-interactive, install everywhere detected')}
  npx @probelabs/vow install --yes

  ${chalk.gray('# Install only git hooks')}
  npx @probelabs/vow install --git

  ${chalk.gray('# Dry run to see what would be installed')}
  npx @probelabs/vow install --dry-run

  ${chalk.gray('# Uninstall from all locations')}
  npx @probelabs/vow install --uninstall
`);
}

/**
 * Perform installation
 */
async function performInstallation(targets, detection, options, selection = {}) {
  const results = [];
  const spinner = ui.createSpinner('Installing Vow...');
  
  if (!options.dryRun) {
    spinner.start();
  }
  
  // Note: AGENT_VOW.md is now optional - uses built-in defaults if not present
  
  // Install to selected targets
  for (const target of targets) {
    let result;
    
    switch (target) {
      case 'git':
        result = installer.installGitHook({
          force: options.force,
          dryRun: options.dryRun
        });
        result.type = 'Git hooks';
        break;
        
      case 'husky':
        result = installer.installHuskyHook(detection, {
          force: options.force,
          dryRun: options.dryRun
        });
        result.type = 'Husky';
        break;
        
      case 'claude':
        result = installer.installClaudeCode(detection, {
          force: options.force,
          dryRun: options.dryRun,
          scope: selection.claudeScope || 'local'
        });
        result.type = 'Claude Code';
        break;
        
      case 'global':
        // TODO: Implement global installation
        result = {
          success: false,
          error: 'Global installation not yet implemented',
          type: 'Global'
        };
        break;
        
      default:
        result = {
          success: false,
          error: `Unknown target: ${target}`,
          type: target
        };
    }
    
    results.push(result);
  }
  
  if (!options.dryRun) {
    spinner.stop();
  }
  
  return results;
}

/**
 * Main installation function
 */
async function main() {
  const options = parseArgs();
  
  // Show help if requested
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  console.log('\nVow - AI Accountability Gate\n');
  
  // Check if we're in a git repository
  if (!gitUtils.isGitRepo()) {
    console.error('Error: Not a git repository');
    console.log('Please run this command from within a git repository');
    process.exit(1);
  }
  
  // Detect environment
  const spinner = ui.createSpinner('Detecting environment...');
  spinner.start();
  
  const detection = detector.detectAll();
  const recommendations = detector.getRecommendations(detection);
  
  spinner.stop();
  
  // Handle uninstall
  if (options.uninstall) {
    console.log('Uninstalling Vow from all locations...\n');
    const results = installer.uninstall(detection, options);
    
    results.forEach(result => {
      if (result.success) {
        console.log(`  - Removed from ${result.type}`);
      } else {
        console.log(`  - Failed to remove from ${result.type}: ${result.error}`);
      }
    });
    
    console.log('\nUninstallation complete\n');
    process.exit(0);
  }
  
  // Determine installation targets
  let targets;
  let selection = null;
  
  if (options.yes || options.git || options.husky || options.claude || options.all || options.global) {
    // Non-interactive mode
    targets = ui.getNonInteractiveTargets(detection, options);
    
    if (targets.length === 0) {
      console.error('No valid installation targets found');
      process.exit(1);
    }
    
    // For non-interactive mode, create a default selection object
    selection = {
      targets: targets,
      scope: 'local',
      claudeScope: 'local' // Default to local scope for Claude Code
    };
    
    console.log('Installing to:');
    targets.forEach(t => console.log(`  - ${t}`));
    console.log('');
  } else {
    // Interactive mode
    selection = await ui.promptInstallation(detection, recommendations);
    
    if (!selection) {
      console.log('\nInstallation cancelled\n');
      process.exit(0);
    }
    
    targets = selection.targets;
  }
  
  // Handle manual installation instructions
  if (targets.includes('manual')) {
    ui.displayManualInstructions(detection);
    process.exit(0);
  }
  
  // Perform installation
  const results = await performInstallation(targets, detection, options, selection);
  
  // Display results
  if (options.dryRun) {
    ui.displayDryRun(results);
  } else {
    ui.displayResults(results);
  }
  
  // Exit with appropriate code
  const hasErrors = results.some(r => !r.success && !r.alreadyInstalled && !r.alreadyExists);
  process.exit(hasErrors ? 1 : 0);
}

// Run main function
main().catch(error => {
  console.error(chalk.red(`\nError: ${error.message}\n`));
  if (parseArgs().verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});