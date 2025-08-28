#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const gitUtils = require('./git-utils');

/**
 * Detect Husky installation
 */
function detectHusky() {
  const repoRoot = gitUtils.getRepoRoot();
  
  // Check for Husky v8/v9 (.husky directory)
  const huskyDir = path.join(repoRoot, '.husky');
  if (fs.existsSync(huskyDir)) {
    const preCommitHook = path.join(huskyDir, 'pre-commit');
    return {
      detected: true,
      version: 'v8+',
      path: huskyDir,
      hasPreCommit: fs.existsSync(preCommitHook),
      preCommitPath: preCommitHook
    };
  }
  
  // Check for Husky v4 and below (package.json)
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.husky) {
        return {
          detected: true,
          version: 'v4',
          config: pkg.husky,
          path: packageJsonPath
        };
      }
    } catch (e) {
      // Invalid package.json
    }
  }
  
  return { detected: false };
}

/**
 * Detect pre-commit framework
 */
function detectPreCommit() {
  const repoRoot = gitUtils.getRepoRoot();
  const configFile = path.join(repoRoot, '.pre-commit-config.yaml');
  
  if (fs.existsSync(configFile)) {
    return {
      detected: true,
      configPath: configFile
    };
  }
  
  return { detected: false };
}

/**
 * Detect lefthook
 */
function detectLefthook() {
  const repoRoot = gitUtils.getRepoRoot();
  const configs = ['lefthook.yml', 'lefthook.yaml', '.lefthook.yml', '.lefthook.yaml'];
  
  for (const config of configs) {
    const configPath = path.join(repoRoot, config);
    if (fs.existsSync(configPath)) {
      return {
        detected: true,
        configPath: configPath
      };
    }
  }
  
  return { detected: false };
}

/**
 * Detect simple-git-hooks
 */
function detectSimpleGitHooks() {
  const repoRoot = gitUtils.getRepoRoot();
  const packageJsonPath = path.join(repoRoot, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg['simple-git-hooks']) {
        return {
          detected: true,
          config: pkg['simple-git-hooks'],
          path: packageJsonPath
        };
      }
    } catch (e) {
      // Invalid package.json
    }
  }
  
  return { detected: false };
}

/**
 * Detect Claude Code settings
 */
function detectClaudeCode() {
  const repoRoot = gitUtils.getRepoRoot();
  const claudeDir = path.join(repoRoot, '.claude');
  
  // Check for .claude directory existence
  const claudeDirExists = fs.existsSync(claudeDir);
  
  // Priority order: settings.local.json > settings.json > claude.json
  const settingsFiles = ['settings.local.json', 'settings.json', 'claude.json'];
  const detectedFiles = {};
  
  for (const file of settingsFiles) {
    const settingsPath = path.join(claudeDir, file);
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        detectedFiles[file] = {
          path: settingsPath,
          settings: settings,
          hasGitHook: !!(settings.gitCommitHook || settings.gitPreCommitHook),
          scope: file === 'settings.local.json' ? 'local' : 
                 file === 'settings.json' ? 'project' : 
                 'project'
        };
      } catch (e) {
        // Invalid JSON
        detectedFiles[file] = {
          path: settingsPath,
          error: 'Invalid JSON'
        };
      }
    }
  }
  
  // Determine primary configuration
  const primaryFile = settingsFiles.find(f => detectedFiles[f] && !detectedFiles[f].error);
  const primary = primaryFile ? detectedFiles[primaryFile] : null;
  
  return {
    detected: claudeDirExists,
    primary: primary,
    files: detectedFiles,
    hasLocalSettings: !!detectedFiles['settings.local.json'],
    hasProjectSettings: !!detectedFiles['settings.json'],
    path: primary?.path || null,
    settings: primary?.settings || null,
    hasGitHook: primary?.hasGitHook || false,
    availableScopes: {
      local: claudeDirExists,  // Can create settings.local.json
      project: claudeDirExists, // Can create/update settings.json
      global: false // Not applicable for Claude Code
    }
  };
}

/**
 * Detect existing git hooks
 */
function detectGitHooks() {
  const hooksInfo = gitUtils.getHooksPath();
  
  if (!hooksInfo.path || !fs.existsSync(hooksInfo.path)) {
    return {
      detected: false,
      path: hooksInfo.path,
      ...hooksInfo
    };
  }
  
  const hooks = {};
  const hookFiles = ['pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit'];
  
  for (const hook of hookFiles) {
    const hookPath = path.join(hooksInfo.path, hook);
    const vowHookPath = path.join(hooksInfo.path, `${hook}-vow`);
    
    // Check main hook
    if (fs.existsSync(hookPath)) {
      try {
        const content = fs.readFileSync(hookPath, 'utf8');
        hooks[hook] = {
          exists: true,
          path: hookPath,
          hasVow: content.includes('vow') || content.includes('AGENT_VOW'),
          content: content.substring(0, 500) // First 500 chars for preview
        };
      } catch (e) {
        hooks[hook] = {
          exists: true,
          path: hookPath,
          error: 'Cannot read hook'
        };
      }
    } else {
      hooks[hook] = {
        exists: false,
        path: hookPath
      };
    }
    
    // Check for separate Vow hook
    if (fs.existsSync(vowHookPath)) {
      try {
        const vowContent = fs.readFileSync(vowHookPath, 'utf8');
        hooks[hook].hasVowHook = true;
        hooks[hook].vowHookPath = vowHookPath;
        hooks[hook].hasVow = true; // Mark as having Vow since separate hook exists
      } catch (e) {
        // Ignore errors reading Vow hook
      }
    }
  }
  
  return {
    detected: true,
    ...hooksInfo,
    hooks: hooks,
    hasAnyHooks: Object.values(hooks).some(h => h.exists),
    hasVowInstalled: Object.values(hooks).some(h => h.hasVow)
  };
}

/**
 * Detect Cursor AI
 */
function detectCursor() {
  const repoRoot = gitUtils.getRepoRoot();
  const cursorDir = path.join(repoRoot, '.cursor');
  
  if (fs.existsSync(cursorDir)) {
    return {
      detected: true,
      path: cursorDir
    };
  }
  
  return { detected: false };
}

/**
 * Detect all hook managers and tools
 */
function detectAll() {
  const gitInfo = gitUtils.getGitConfig();
  
  if (!gitInfo.isRepo) {
    return {
      error: 'Not a git repository',
      gitInfo: gitInfo
    };
  }
  
  return {
    git: gitInfo,
    gitHooks: detectGitHooks(),
    husky: detectHusky(),
    preCommit: detectPreCommit(),
    lefthook: detectLefthook(),
    simpleGitHooks: detectSimpleGitHooks(),
    claudeCode: detectClaudeCode(),
    cursor: detectCursor(),
    summary: {
      hasGitHooks: detectGitHooks().hasAnyHooks,
      hasHusky: detectHusky().detected,
      hasClaudeCode: detectClaudeCode().detected,
      hasOtherManagers: detectPreCommit().detected || detectLefthook().detected || detectSimpleGitHooks().detected,
      isWorktree: gitInfo.isWorktree,
      hasCustomHooksPath: gitInfo.hooksPath?.isCustom || false
    }
  };
}

/**
 * Get installation recommendations based on detection
 */
function getRecommendations(detection) {
  const recommendations = [];
  
  if (detection.husky.detected) {
    recommendations.push({
      type: 'husky',
      priority: 1,
      reason: 'Husky is already configured in this project'
    });
  }
  
  if (detection.claudeCode.detected) {
    recommendations.push({
      type: 'claude',
      priority: 2,
      reason: 'Claude Code is detected in this project'
    });
  }
  
  if (!detection.summary.hasHusky && !detection.summary.hasOtherManagers) {
    recommendations.push({
      type: 'git',
      priority: 3,
      reason: 'Direct git hooks (no hook manager detected)'
    });
  }
  
  if (detection.summary.isWorktree) {
    recommendations.push({
      type: 'warning',
      message: 'This is a git worktree. Hooks may affect the main repository.'
    });
  }
  
  if (detection.summary.hasCustomHooksPath) {
    recommendations.push({
      type: 'warning',
      message: `Custom hooks directory detected: ${detection.git.hooksPath.path}`
    });
  }
  
  return recommendations.sort((a, b) => (a.priority || 99) - (b.priority || 99));
}

module.exports = {
  detectHusky,
  detectPreCommit,
  detectLefthook,
  detectSimpleGitHooks,
  detectClaudeCode,
  detectCursor,
  detectGitHooks,
  detectAll,
  getRecommendations
};