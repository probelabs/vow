#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Execute a git command safely
 */
function execGit(command, options = {}) {
  try {
    return execSync(`git ${command}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      ...options
    }).trim();
  } catch (e) {
    return null;
  }
}

/**
 * Get the git repository root
 */
function getRepoRoot() {
  return execGit('rev-parse --show-toplevel') || process.cwd();
}

/**
 * Check if we're in a git repository
 */
function isGitRepo() {
  return execGit('rev-parse --git-dir') !== null;
}

/**
 * Check if this is a git worktree
 */
function isWorktree() {
  const gitPath = path.join(process.cwd(), '.git');
  
  try {
    const stats = fs.statSync(gitPath);
    if (stats.isFile()) {
      // .git is a file in worktrees
      const content = fs.readFileSync(gitPath, 'utf8');
      return content.startsWith('gitdir:');
    }
  } catch (e) {
    // .git doesn't exist or can't be read
  }
  
  return false;
}

/**
 * Get worktree information
 */
function getWorktreeInfo() {
  if (!isWorktree()) {
    return null;
  }
  
  try {
    const gitFile = fs.readFileSync('.git', 'utf8');
    const match = gitFile.match(/^gitdir:\s*(.+)$/m);
    
    if (match) {
      const worktreeGitDir = match[1].trim();
      // The main repository is typically two directories up from the worktree git dir
      // e.g., .git/worktrees/branch-name -> main repo is at ../..
      const mainRepoPath = path.resolve(worktreeGitDir, '..', '..', '..');
      
      return {
        gitDir: worktreeGitDir,
        mainRepo: mainRepoPath,
        isWorktree: true
      };
    }
  } catch (e) {
    // Error reading worktree info
  }
  
  return null;
}

/**
 * Get the hooks directory path
 */
function getHooksPath() {
  // First check for custom hooks path
  const customPath = execGit('config core.hooksPath');
  if (customPath) {
    return {
      path: customPath,
      isCustom: true,
      isGlobal: false
    };
  }
  
  // Check for global hooks path
  const globalPath = execGit('config --global core.hooksPath');
  if (globalPath) {
    return {
      path: globalPath,
      isCustom: true,
      isGlobal: true
    };
  }
  
  // Check if we're in a worktree
  const worktreeInfo = getWorktreeInfo();
  if (worktreeInfo) {
    // For worktrees, hooks are typically in the main repo
    return {
      path: path.join(worktreeInfo.mainRepo, '.git', 'hooks'),
      isCustom: false,
      isGlobal: false,
      isWorktree: true,
      mainRepo: worktreeInfo.mainRepo
    };
  }
  
  // Standard repository hooks
  const gitDir = execGit('rev-parse --git-dir') || '.git';
  return {
    path: path.join(gitDir, 'hooks'),
    isCustom: false,
    isGlobal: false
  };
}

/**
 * Check if a bare repository
 */
function isBareRepo() {
  const result = execGit('config --get core.bare');
  return result === 'true';
}

/**
 * Get git version
 */
function getGitVersion() {
  const version = execGit('--version');
  if (version) {
    const match = version.match(/git version (\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Check if hooks directory exists and is writable
 */
function isHooksWritable(hooksPath) {
  try {
    // Check if directory exists
    if (!fs.existsSync(hooksPath)) {
      // Try to create it
      fs.mkdirSync(hooksPath, { recursive: true });
    }
    
    // Check if writable
    fs.accessSync(hooksPath, fs.constants.W_OK);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get all git configuration for debugging
 */
function getGitConfig() {
  return {
    isRepo: isGitRepo(),
    repoRoot: getRepoRoot(),
    isWorktree: isWorktree(),
    worktreeInfo: getWorktreeInfo(),
    hooksPath: getHooksPath(),
    isBare: isBareRepo(),
    version: getGitVersion()
  };
}

module.exports = {
  execGit,
  getRepoRoot,
  isGitRepo,
  isWorktree,
  getWorktreeInfo,
  getHooksPath,
  isBareRepo,
  getGitVersion,
  isHooksWritable,
  getGitConfig
};