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
  
  // Add git commit hook
  const gitCommitHook = {
    "matcher": "Bash",
    "hooks": [
      {
        "type": "command",
        "command": `if echo "$CLAUDE_TOOL_INPUT" | jq -r '.command' | grep -q '^git commit'; then ${VOW_COMMAND}; fi`
      }
    ]
  };
  
  // Check if this hook already exists
  const existingHook = settings.hooks.PreToolUse.find(h => 
    h.matcher === "Bash" && 
    h.hooks && 
    h.hooks.some(hook => hook.command && hook.command.includes('vow'))
  );
  
  if (!existingHook) {
    settings.hooks.PreToolUse.push(gitCommitHook);
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
  
  // Get template content
  const templatePath = path.join(__dirname, '..', 'templates', `${template}.md`);
  let content;
  
  if (fs.existsSync(templatePath)) {
    content = fs.readFileSync(templatePath, 'utf8');
  } else {
    // Use default content if template doesn't exist
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
  return `# AGENT TASK COMPLETION CONSENT

Before finishing this task, you must honestly review your work.
**Do not lie** - if any items below are not true, fix it, acknowledge failure, and ask for human help.

## TASK ADHERENCE

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
- ✓ If I cannot complete the task, I am ready to explain why to the user

---

**If you agree with all applicable items above**, create the consent file with **EXACTLY** the content '1':

\`\`\`bash
printf '1' | tee .AGENT_CONSENT >/dev/null
\`\`\`

**IMPORTANT**: The file must contain exactly '1' (no extra spaces, newlines, or other content).
Any other content will be rejected as invalid consent.

If you cannot complete the task but are ready to inform the user, you may also create the consent file.
`;
}

/**
 * Uninstall Vow from all locations
 */
function uninstall(detection, options = {}) {
  const results = [];
  
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
            
            fs.writeFileSync(hookInfo.path, content);
          } else {
            // Old approach - remove Vow sections from main hook
            let content = fs.readFileSync(hookInfo.path, 'utf8');
            content = content.replace(/\n?# Vow - AI accountability gate[\s\S]*?fi\n/g, '');
            content = content.replace(new RegExp(`\n?${VOW_COMMAND}.*\n`, 'g'), '');
            
            fs.writeFileSync(hookInfo.path, content);
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
        
        // Clean up empty hooks structure
        if (settings.hooks.PreToolUse.length === 0) {
          delete settings.hooks.PreToolUse;
        }
        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
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
  uninstall,
  VOW_COMMAND
};