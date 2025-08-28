#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const gitUtils = require('./git-utils');

const VOW_COMMAND = 'npx @probelabs/vow check';

/**
 * Install git hook - creates a separate Vow hook that runs at the end
 */
function installGitHook(options = {}) {
  const { hookName = 'pre-commit', force = false, dryRun = false } = options;
  const hooksInfo = gitUtils.getHooksPath();
  
  if (!hooksInfo.path) {
    return {
      success: false,
      error: 'Cannot determine git hooks directory'
    };
  }
  
  // Check if hooks directory is writable
  if (!dryRun && !gitUtils.isHooksWritable(hooksInfo.path)) {
    return {
      success: false,
      error: `Hooks directory is not writable: ${hooksInfo.path}`
    };
  }
  
  // Use a separate hook file that runs at the end
  const vowHookName = `${hookName}-vow`;
  const vowHookPath = path.join(hooksInfo.path, vowHookName);
  const mainHookPath = path.join(hooksInfo.path, hookName);
  
  // Check if Vow hook already exists
  if (fs.existsSync(vowHookPath) && !force) {
    return {
      success: false,
      error: `Vow hook already exists: ${vowHookName}`,
      alreadyInstalled: true
    };
  }
  
  // Create the Vow hook content
  const vowHookContent = `#!/bin/sh
# Vow - AI accountability gate
# This hook runs at the end of the pre-commit pipeline

${VOW_COMMAND}
if [ $? -ne 0 ]; then
  echo "Vow check failed. Commit aborted."
  exit 1
fi
`;
  
  
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      wouldWrite: vowHookPath,
      content: vowHookContent,
      approach: 'separate-hook'
    };
  }
  
  try {
    // Write the Vow hook file
    fs.writeFileSync(vowHookPath, vowHookContent);
    fs.chmodSync(vowHookPath, '755');
    
    // Now modify the main hook to call the Vow hook at the end
    let mainHookContent = '';
    
    if (fs.existsSync(mainHookPath)) {
      mainHookContent = fs.readFileSync(mainHookPath, 'utf8');
      
      // Check if we already call the Vow hook
      if (mainHookContent.includes(vowHookName)) {
        // Already integrated
        return {
          success: true,
          path: vowHookPath,
          mainHook: mainHookPath,
          isNew: false,
          approach: 'separate-hook'
        };
      }
    } else {
      // Create new main hook
      mainHookContent = '#!/bin/sh\n';
    }
    
    // Add call to Vow hook at the end
    const vowCall = `\n# Run Vow accountability check at the end\n./.git/hooks/${vowHookName}\n`;
    
    // Handle custom hooks path
    const vowCallPath = hooksInfo.isCustom 
      ? `\n# Run Vow accountability check at the end\n"$(git config core.hooksPath)/${vowHookName}"\n`
      : vowCall;
    
    if (!mainHookContent.includes(vowHookName)) {
      mainHookContent += vowCallPath;
    }
    
    // Write updated main hook
    fs.writeFileSync(mainHookPath, mainHookContent);
    fs.chmodSync(mainHookPath, '755');
    
    return {
      success: true,
      path: vowHookPath,
      mainHook: mainHookPath,
      isNew: !fs.existsSync(vowHookPath),
      approach: 'separate-hook'
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to create Vow hook: ${e.message}`
    };
  }
}

/**
 * Install Husky hook
 */
function installHuskyHook(detection, options = {}) {
  const { hookName = 'pre-commit', force = false, dryRun = false } = options;
  
  if (!detection.husky.detected) {
    return {
      success: false,
      error: 'Husky is not detected in this project'
    };
  }
  
  if (detection.husky.version === 'v4') {
    return installHuskyV4(detection, options);
  }
  
  // Husky v8+
  const hookPath = path.join(detection.husky.path, hookName);
  let hookContent = '';
  
  if (fs.existsSync(hookPath)) {
    hookContent = fs.readFileSync(hookPath, 'utf8');
    
    // Check if Vow is already installed
    if (hookContent.includes(VOW_COMMAND) || hookContent.includes('vow')) {
      if (!force) {
        return {
          success: false,
          error: 'Vow is already installed in this Husky hook',
          alreadyInstalled: true
        };
      }
    }
  }
  
  // Add Vow command
  if (!hookContent) {
    // New hook file
    hookContent = `#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

${VOW_COMMAND}
`;
  } else {
    // Append to existing
    hookContent += `\n${VOW_COMMAND}\n`;
  }
  
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      wouldWrite: hookPath,
      content: hookContent
    };
  }
  
  try {
    fs.writeFileSync(hookPath, hookContent);
    fs.chmodSync(hookPath, '755');
    
    return {
      success: true,
      path: hookPath,
      isNew: !fs.existsSync(hookPath)
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to write Husky hook: ${e.message}`
    };
  }
}

/**
 * Install Husky v4 hook (in package.json)
 */
function installHuskyV4(detection, options = {}) {
  const { hookName = 'pre-commit', dryRun = false } = options;
  const packagePath = detection.husky.path;
  
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    if (!pkg.husky) {
      pkg.husky = { hooks: {} };
    }
    if (!pkg.husky.hooks) {
      pkg.husky.hooks = {};
    }
    
    const existingHook = pkg.husky.hooks[hookName] || '';
    
    // Check if Vow is already there
    if (existingHook.includes('vow')) {
      return {
        success: false,
        error: 'Vow is already in Husky v4 configuration',
        alreadyInstalled: true
      };
    }
    
    // Add Vow command
    const vowCommand = existingHook 
      ? `${VOW_COMMAND} && ${existingHook}`
      : VOW_COMMAND;
    
    pkg.husky.hooks[hookName] = vowCommand;
    
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        wouldWrite: packagePath,
        content: JSON.stringify(pkg, null, 2)
      };
    }
    
    // Write updated package.json
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
    
    return {
      success: true,
      path: packagePath,
      hookName: hookName
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to update package.json: ${e.message}`
    };
  }
}

/**
 * Install Claude Code hook
 */
function installClaudeCode(detection, options = {}) {
  const { force = false, dryRun = false, scope = 'local' } = options;
  const repoRoot = gitUtils.getRepoRoot();
  const claudeDir = path.join(repoRoot, '.claude');
  
  // Create .claude directory if it doesn't exist
  if (!dryRun && !fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  
  // Determine settings file based on scope
  let settingsFileName;
  if (scope === 'local' || scope === 'user') {
    settingsFileName = 'settings.local.json';
  } else if (scope === 'project') {
    settingsFileName = 'settings.json';
  } else {
    // Default to local
    settingsFileName = 'settings.local.json';
  }
  
  const settingsPath = path.join(claudeDir, settingsFileName);
  
  // Check if we should use existing file or specified scope
  let useExisting = false;
  if (detection.claudeCode.files && detection.claudeCode.files[settingsFileName]) {
    const fileInfo = detection.claudeCode.files[settingsFileName];
    if (fileInfo.hasGitHook && !force) {
      return {
        success: false,
        error: `Vow is already configured in ${settingsFileName}`,
        alreadyInstalled: true,
        scope: scope
      };
    }
    useExisting = !fileInfo.error;
  }
  
  let settings = {};
  let backupPath = null;
  
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      
      // Check if Vow is already configured
      const hasVowHook = settings.hooks && 
        settings.hooks.PreToolUse && 
        settings.hooks.PreToolUse.some(hook => 
          hook.hooks && 
          hook.hooks.some(h => h.command && h.command.includes('vow'))
        );
        
      if (hasVowHook) {
        if (!force) {
          return {
            success: false,
            error: `Vow is already configured in ${settingsFileName}`,
            alreadyInstalled: true,
            scope: scope
          };
        }
      }
      
    } catch (e) {
      // Invalid JSON, will overwrite
      console.warn(`Invalid JSON in ${settingsPath}, will create new settings`);
      settings = {};
    }
  }
  
  // Add Vow configuration using proper Claude Code hooks
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.PreToolUse) {
    settings.hooks.PreToolUse = [];
  }
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [];
  }
  
  // Add permissions for vow consent command if not already present
  if (!settings.permissions) {
    settings.permissions = {};
  }
  if (!settings.permissions.allow) {
    settings.permissions.allow = [];
  }
  // Add permissions for vow commands
  const vowPermissions = [
    'Bash(npx -y @probelabs/vow@latest:*)',
    'Bash(npx -y @probelabs/vow@latest consent:*)',
    'Bash(npx -y @probelabs/vow@latest rules:*)'
  ];
  
  vowPermissions.forEach(permission => {
    if (!settings.permissions.allow.includes(permission)) {
      settings.permissions.allow.push(permission);
    }
  });
  
  // Add git commit hook
  const gitCommitHook = {
    "matcher": "Bash",
    "hooks": [
      {
        "type": "command",
        "command": `${VOW_COMMAND} --hook --hook-type=PreToolUseGit`
      }
    ]
  };
  
  // Add Stop hook
  const stopHook = {
    "hooks": [
      {
        "type": "command",
        "command": `${VOW_COMMAND} --hook --hook-type=Stop`
      }
    ]
  };
  
  
  // Check if PreToolUse hook already exists
  const existingPreToolHook = settings.hooks.PreToolUse.find(h => 
    h.matcher === "Bash" && 
    h.hooks && 
    h.hooks.some(hook => hook.command && hook.command.includes('vow'))
  );
  
  if (!existingPreToolHook || force) {
    if (existingPreToolHook && force) {
      // Remove existing hook first
      const index = settings.hooks.PreToolUse.indexOf(existingPreToolHook);
      settings.hooks.PreToolUse.splice(index, 1);
    }
    settings.hooks.PreToolUse.push(gitCommitHook);
  }
  
  // Check if Stop hook already exists
  const existingStopHook = settings.hooks.Stop.find(h =>
    h.hooks &&
    h.hooks.some(hook => hook.command && hook.command.includes('vow'))
  );
  
  if (!existingStopHook || force) {
    if (existingStopHook && force) {
      // Remove existing hook first
      const index = settings.hooks.Stop.indexOf(existingStopHook);
      settings.hooks.Stop.splice(index, 1);
    }
    settings.hooks.Stop.push(stopHook);
  }
  
  
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      wouldWrite: settingsPath,
      content: JSON.stringify(settings, null, 2),
      scope: scope
    };
  }
  
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    
    return {
      success: true,
      path: settingsPath,
      isNew: !fs.existsSync(settingsPath),
      scope: scope
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to write Claude Code settings: ${e.message}`,
      scope: scope
    };
  }
}

/**
 * Manage .gitignore entries
 */
function manageGitignore(options = {}) {
  const { dryRun = false } = options;
  const repoRoot = gitUtils.getRepoRoot();
  const gitignorePath = path.join(repoRoot, '.gitignore');
  
  const entriesToAdd = [
    '.vow-challenge',
    '.vow-consent'
  ];
  
  let gitignoreContent = '';
  let existingEntries = [];
  
  // Read existing .gitignore if it exists
  if (fs.existsSync(gitignorePath)) {
    try {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      existingEntries = gitignoreContent.split('\n').map(line => line.trim());
    } catch (e) {
      // Couldn't read file, will create new
    }
  }
  
  // Check which entries need to be added
  const missingEntries = entriesToAdd.filter(entry => 
    !existingEntries.includes(entry)
  );
  
  if (missingEntries.length === 0) {
    return {
      success: true,
      message: 'All entries already in .gitignore',
      alreadyExists: true
    };
  }
  
  // Add missing entries
  if (gitignoreContent && !gitignoreContent.endsWith('\n')) {
    gitignoreContent += '\n';
  }
  
  // Add comment if adding vow entries
  if (missingEntries.length > 0) {
    if (gitignoreContent) {
      gitignoreContent += '\n';
    }
    gitignoreContent += '# Vow - AI accountability files\n';
    gitignoreContent += missingEntries.join('\n') + '\n';
  }
  
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      wouldWrite: gitignorePath,
      wouldAdd: missingEntries,
      content: gitignoreContent
    };
  }
  
  try {
    fs.writeFileSync(gitignorePath, gitignoreContent);
    return {
      success: true,
      path: gitignorePath,
      added: missingEntries,
      isNew: !fs.existsSync(gitignorePath)
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to update .gitignore: ${e.message}`
    };
  }
}

/**
 * Install AGENT_VOW.md file
 */
function installVowFile(options = {}) {
  const { template = 'default', force = false, dryRun = false } = options;
  const repoRoot = gitUtils.getRepoRoot();
  const vowPath = path.join(repoRoot, 'AGENT_VOW.md');
  
  // Check if already exists
  if (fs.existsSync(vowPath) && !force) {
    return {
      success: false,
      error: 'AGENT_VOW.md already exists',
      alreadyExists: true
    };
  }
  
  // Get content from package's AGENT_VOW.md
  const packageVowPath = path.join(__dirname, '..', 'AGENT_VOW.md');
  let content;
  
  if (fs.existsSync(packageVowPath)) {
    content = fs.readFileSync(packageVowPath, 'utf8');
  } else {
    // Fallback to hardcoded content if package file doesn't exist
    content = getDefaultVowContent();
  }
  
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      wouldWrite: vowPath,
      content: content
    };
  }
  
  try {
    fs.writeFileSync(vowPath, content);
    
    return {
      success: true,
      path: vowPath,
      isNew: !fs.existsSync(vowPath)
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to write AGENT_VOW.md: ${e.message}`
    };
  }
}

/**
 * Get default vow content
 */
function getDefaultVowContent() {
  return `## TASK ADHERENCE

- ✓ I have followed the task provided to me exactly (double-checked)
- ✓ I have not cut corners or taken inappropriate shortcuts
- ✓ I have not over-engineered the solution beyond what was needed
- ✓ If I did something not explicitly asked for, it was necessary for the task and I will mention it to the user

## CODE QUALITY (if code was modified)

- ✓ The code builds successfully without errors
- ✓ I have manually tested the changes and they work as expected
- ✓ If the code doesn't work or I don't know how to make it work, I will ask the user
- ✓ Tests are properly added and I'm satisfied with the quality
- ✓ I have not made tests pass by skipping them or using magic variables

## COMMIT SPECIFIC (for git commits)

- ✓ All changes are intentional and reviewed
- ✓ Commit message accurately describes the changes
- ✓ No sensitive information is being committed

## COMMUNICATION QUALITY

- ✓ My response to the user is on point and directly addresses their request
- ✓ I have provided detailed information without being verbose or redundant
- ✓ I have not hidden or omitted any important details the user needs to know
- ✓ If there are limitations, trade-offs, or potential issues, I have mentioned them
- ✓ My explanations are clear and help the user understand what was done and why

## TASK COMPLETION

- ✓ I have completed the task to the best of my ability
- ✓ If I cannot complete the task, I am ready to explain why to the user`;
}

/**
 * Remove entries from .gitignore
 */
function cleanupGitignore(options = {}) {
  const { dryRun = false } = options;
  const repoRoot = gitUtils.getRepoRoot();
  const gitignorePath = path.join(repoRoot, '.gitignore');
  
  if (!fs.existsSync(gitignorePath)) {
    return {
      success: true,
      message: 'No .gitignore file found'
    };
  }
  
  try {
    let content = fs.readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n');
    
    // Remove Vow-related entries and comment
    const filteredLines = [];
    let skipNextLines = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is the Vow comment
      if (line.includes('# Vow - AI accountability files')) {
        skipNextLines = true;
        continue;
      }
      
      // Skip Vow-related entries
      if (skipNextLines && (line === '.vow-challenge' || line === '.vow-consent')) {
        continue;
      } else if (skipNextLines && line.trim() === '') {
        // Skip empty line after Vow entries
        skipNextLines = false;
        continue;
      } else {
        skipNextLines = false;
      }
      
      // Also remove if they exist elsewhere
      if (line === '.vow-challenge' || line === '.vow-consent') {
        continue;
      }
      
      filteredLines.push(line);
    }
    
    const newContent = filteredLines.join('\n');
    
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        wouldWrite: gitignorePath,
        content: newContent
      };
    }
    
    fs.writeFileSync(gitignorePath, newContent);
    
    return {
      success: true,
      path: gitignorePath,
      message: 'Removed Vow entries from .gitignore'
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to clean .gitignore: ${e.message}`
    };
  }
}

/**
 * Clean up Vow temporary files
 */
function cleanupVowFiles(options = {}) {
  const { dryRun = false } = options;
  const repoRoot = gitUtils.getRepoRoot();
  const files = ['.vow-challenge', '.vow-consent'];
  const cleaned = [];
  
  for (const file of files) {
    const filePath = path.join(repoRoot, file);
    if (fs.existsSync(filePath)) {
      if (!dryRun) {
        try {
          fs.unlinkSync(filePath);
          cleaned.push(file);
        } catch (e) {
          // Ignore errors
        }
      } else {
        cleaned.push(file);
      }
    }
  }
  
  return {
    success: true,
    cleaned: cleaned,
    dryRun: dryRun
  };
}

/**
 * Uninstall Vow from all locations
 */
function uninstall(detection, options = {}) {
  const results = [];
  
  // Clean up temporary files first
  const fileCleanup = cleanupVowFiles(options);
  if (fileCleanup.cleaned.length > 0) {
    results.push({
      type: 'temporary-files',
      success: true,
      cleaned: fileCleanup.cleaned
    });
  }
  
  // Clean up .gitignore entries
  const gitignoreCleanup = cleanupGitignore(options);
  if (gitignoreCleanup.success && !gitignoreCleanup.message?.includes('No .gitignore')) {
    results.push({
      type: 'gitignore',
      success: gitignoreCleanup.success,
      message: gitignoreCleanup.message
    });
  }
  
  // Remove from git hooks
  if (detection.gitHooks.hasVowInstalled) {
    for (const [hookName, hookInfo] of Object.entries(detection.gitHooks.hooks)) {
      if (hookInfo.hasVow && hookInfo.exists) {
        try {
          // If separate Vow hook exists, remove it and clean main hook
          if (hookInfo.hasVowHook && hookInfo.vowHookPath) {
            // Remove the separate Vow hook file
            if (fs.existsSync(hookInfo.vowHookPath)) {
              fs.unlinkSync(hookInfo.vowHookPath);
            }
            
            // Remove Vow call from main hook
            let content = fs.readFileSync(hookInfo.path, 'utf8');
            content = content.replace(/\n?# Run Vow accountability check at the end[\s\S]*?pre-commit-vow[^\n]*/g, '');
            content = content.replace(new RegExp(`\\n.*${hookName}-vow.*\\n`, 'g'), '');
            
            // If hook is now empty (only shebang), remove it
            if (content.trim() === '#!/bin/sh') {
              fs.unlinkSync(hookInfo.path);
            } else {
              fs.writeFileSync(hookInfo.path, content);
            }
          } else {
            // Old approach - remove Vow sections from main hook
            let content = fs.readFileSync(hookInfo.path, 'utf8');
            content = content.replace(/\n?# Vow - AI accountability gate[\s\S]*?fi\n/g, '');
            content = content.replace(new RegExp(`\n?${VOW_COMMAND}.*\n`, 'g'), '');
            
            // If hook is now empty (only shebang), remove it
            if (content.trim() === '#!/bin/sh') {
              fs.unlinkSync(hookInfo.path);
            } else {
              fs.writeFileSync(hookInfo.path, content);
            }
          }
          
          results.push({
            type: 'git-hook',
            hook: hookName,
            success: true
          });
        } catch (e) {
          results.push({
            type: 'git-hook',
            hook: hookName,
            success: false,
            error: e.message
          });
        }
      }
    }
  }
  
  // Remove from Husky
  if (detection.husky.detected && detection.husky.hasPreCommit) {
    try {
      const hookPath = detection.husky.preCommitPath;
      let content = fs.readFileSync(hookPath, 'utf8');
      content = content.replace(new RegExp(`\n?${VOW_COMMAND}.*\n`, 'g'), '');
      fs.writeFileSync(hookPath, content);
      results.push({
        type: 'husky',
        success: true
      });
    } catch (e) {
      results.push({
        type: 'husky',
        success: false,
        error: e.message
      });
    }
  }
  
  // Remove from Claude Code
  if (detection.claudeCode.detected && detection.claudeCode.hasGitHook) {
    try {
      const settings = JSON.parse(fs.readFileSync(detection.claudeCode.path, 'utf8'));
      
      // Remove old gitCommitHook if it exists
      if (settings.gitCommitHook && settings.gitCommitHook.includes('vow')) {
        delete settings.gitCommitHook;
      }
      
      // Remove new PreToolUse hooks that contain vow
      if (settings.hooks && settings.hooks.PreToolUse) {
        settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(hook => 
          !(hook.hooks && hook.hooks.some(h => h.command && h.command.includes('vow')))
        );
        
        // Clean up empty PreToolUse hooks
        if (settings.hooks.PreToolUse.length === 0) {
          delete settings.hooks.PreToolUse;
        }
      }
      
      // Remove Stop hooks that contain vow
      if (settings.hooks && settings.hooks.Stop) {
        settings.hooks.Stop = settings.hooks.Stop.filter(hook =>
          !(hook.hooks && hook.hooks.some(h => h.command && h.command.includes('vow')))
        );
        
        // Clean up empty Stop hooks
        if (settings.hooks.Stop.length === 0) {
          delete settings.hooks.Stop;
        }
      }
      
      
      // Clean up empty hooks structure
      if (settings.hooks && Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }
      
      // Remove vow consent permission
      if (settings.permissions && settings.permissions.allow) {
        settings.permissions.allow = settings.permissions.allow.filter(perm => 
          !perm.includes('@probelabs/vow') && !perm.includes('vow@latest consent')
        );
        
        // Clean up empty permissions
        if (settings.permissions.allow.length === 0) {
          delete settings.permissions.allow;
        }
        if (Object.keys(settings.permissions).length === 0) {
          delete settings.permissions;
        }
      }
      
      fs.writeFileSync(detection.claudeCode.path, JSON.stringify(settings, null, 2) + '\n');
      results.push({
        type: 'claude',
        success: true
      });
    } catch (e) {
      results.push({
        type: 'claude',
        success: false,
        error: e.message
      });
    }
  }
  
  return results;
}

module.exports = {
  installGitHook,
  installHuskyHook,
  installClaudeCode,
  installVowFile,
  getDefaultVowContent,
  manageGitignore,
  cleanupGitignore,
  cleanupVowFiles,
  uninstall,
  VOW_COMMAND
};