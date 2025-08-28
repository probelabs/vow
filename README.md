# 🤝 Vow

[![npm version](https://img.shields.io/npm/v/@probelabs/vow)](https://www.npmjs.com/package/@probelabs/vow)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/website-probelabs.com%2Fvow-blue)](https://probelabs.com/vow/)

![A pinky promise between robot and human representing the sacred covenant of AI accountability](site/assets/pinky-promise.jpg)

> A sacred covenant between machine and man. Accountability gates for AI agents.

Vow ensures AI agents pause and honestly self-review before taking action. No shortcuts. No lies. No claiming completion without actual completion.

## ✨ Features

- 🛡️ **Accountability Gates** - AI must affirm checklist requirements before proceeding
- 📝 **Customizable Rules** - Override default vows with your own requirements
- 🔌 **Universal Integration** - Works with git hooks, Husky, Claude Code, and any trigger
- 🎯 **Zero Config** - Sensible defaults that work out of the box
- 🪶 **Lightweight** - 40 lines of JavaScript, no dependencies

## 🚀 Quick Start

### Interactive Installation (Recommended)

```bash
npx -y @probelabs/vow@latest install
```

This will:
- Detect your git setup (including worktrees and custom hooks)
- Find existing hook managers (Husky, pre-commit, etc.)
- Detect AI tools (Claude Code, Cursor)
- Let you choose where to install Vow
- Uses AGENT_VOW.md for rules (local if exists, otherwise from package)

### Non-Interactive Installation

```bash
# Auto-detect and install everywhere applicable
npx -y @probelabs/vow@latest install --yes

# Install only in specific locations
npx -y @probelabs/vow@latest install --git     # Git hooks only
npx -y @probelabs/vow@latest install --husky   # Husky only
npx -y @probelabs/vow@latest install --claude  # Claude Code only
```

## 📖 How It Works

### The Flow

1. **AI attempts an action** (e.g., git commit)
2. **Vow intercepts** via configured hook
3. **Rules are displayed** from AGENT_VOW.md
4. **AI must self-assess** against each requirement
5. **Consent required** - AI creates `.AGENT_CONSENT` file with '1'
6. **Action proceeds** only after consent

### Technical Details

- **Hook Integration**: Vow installs as a git pre-commit hook or similar
- **Exit Codes**: Returns 1 (block) if no consent, 0 (allow) if consent given
- **Consent File**: `.AGENT_CONSENT` file created to indicate consent
- **Auto-cleanup**: Consent file is removed after check
- **Rules Source**: Uses local AGENT_VOW.md if exists, otherwise uses package's AGENT_VOW.md

## 🎯 Use Cases

### Git Commit Hooks
Prevent AI from committing without review. [Learn more about Git hooks](https://git-scm.com/docs/githooks):

**Automatic Installation** (Recommended):
```bash
npx -y @probelabs/vow@latest install --git
```

**Manual Installation**:
```bash
# Add this one-liner to your existing pre-commit hook:
npx -y @probelabs/vow@latest check || exit 1

# Or for Husky v9 (recommended): https://typicode.github.io/husky/
npx husky init
echo 'npx -y @probelabs/vow@latest check' >> .husky/pre-commit
```

### Claude Code Integration
Vow automatically configures Claude Code settings with intelligent scope selection. [Learn more about Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/configuring#hooks):

```bash
# Interactive installation with scope choice
npx -y @probelabs/vow@latest install

# Choose between:
# • Local (settings.local.json) - affects only your user account
# • Project (settings.json) - affects all users of this project
```

**Manual Configuration:**

```json
// .claude/settings.local.json or .claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "if echo \"$CLAUDE_TOOL_INPUT\" | jq -r '.command' | grep -q '^git commit'; then npx -y @probelabs/vow@latest check; fi"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @probelabs/vow@latest check"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @probelabs/vow@latest check"
          }
        ]
      }
    ]
  }
}
```

### Custom Triggers
Use in any workflow where AI accountability matters:

```bash
# In your CI/CD pipeline
npx -y @probelabs/vow@latest check || exit 1
```

## 📝 Custom Vows

Vow works out of the box with built-in defaults, but you can customize the accountability rules for your specific project needs.

### View Current Rules

See what rules are currently active (local AGENT_VOW.md or package default):

```bash
npx -y @probelabs/vow@latest rules
```

### Create Custom Rules

**Step 1: Generate starting template**
```bash
# Export current rules to a file as your starting point
npx -y @probelabs/vow@latest rules > AGENT_VOW.md
```

**Step 2: Customize the rules**
Edit `AGENT_VOW.md` to add your project-specific requirements:

```markdown
# AGENT TASK COMPLETION CONSENT

Before finishing this task, you must honestly review your work.
**Do not lie** - if any items below are not true, fix it.

## TASK ADHERENCE
- ✓ I have followed the task exactly
- ✓ I have not cut corners or taken shortcuts

## CODE QUALITY (if code was modified)
- ✓ The code builds successfully without errors
- ✓ All tests pass and new tests are added where needed

## PROJECT-SPECIFIC RULES
- ✓ I have updated the changelog with my changes
- ✓ Documentation reflects the new functionality
- ✓ No sensitive API keys or credentials are exposed
- ✓ Code follows the project's style guide
- ✓ I have tested the changes in staging environment

---

**If you agree with all above**, create consent file:
\`\`\`bash
printf '1' | tee .AGENT_CONSENT >/dev/null
\`\`\`
```

**Step 3: Test your custom rules**
```bash
# Test that your custom rules work
git commit --allow-empty -m "test custom rules"
```

### Reset to Defaults

Remove your custom rules to return to built-in defaults:

```bash
rm AGENT_VOW.md
npx -y @probelabs/vow@latest check  # Now uses built-in defaults again
```

## 🎮 Commands

### `vow`
Interactive installation wizard. This is the default command for setup.

```bash
npx -y @probelabs/vow@latest  # Interactive installation (same as vow install)
```

### `npx -y @probelabs/vow@latest check`
Check if AI has taken the vow. This command runs in git hooks.

```bash
npx -y @probelabs/vow@latest check  # Returns exit code 1 if vow not taken, 0 if taken
```

### `npx -y @probelabs/vow@latest consent <code>`
Write validation code to the consent file. This command is used by AI to provide consent after reviewing the rules.

```bash
npx -y @probelabs/vow@latest consent 123  # Writes "123" to .vow-consent file
```

### `vow install`
Interactive installation wizard with smart detection.

```bash
npx -y @probelabs/vow@latest install [options]

Options:
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
```

### `npx -y @probelabs/vow@latest rules`
Display the current rules being used (local AGENT_VOW.md or package default).

```bash
npx -y @probelabs/vow@latest rules  # Shows the active accountability rules
```

## 🔍 Detection Capabilities

Vow automatically detects:

### Git Configurations
- ✅ Standard git repositories
- ✅ Git worktrees (with main repo detection)
- ✅ Custom hooks directories (`core.hooksPath`)
- ✅ Global git hooks
- ✅ Bare repositories

### Hook Managers
- ✅ **[Husky](https://typicode.github.io/husky/)** v4, v8, v9 (with v9 simplified syntax)
- ✅ **pre-commit** framework
- ✅ **lefthook**
- ✅ **simple-git-hooks**

### AI Tools
- ✅ **Claude Code** with comprehensive hook support:
  - Basic `gitCommitHook` configuration
  - Advanced `PreToolUse`, `Stop`, `SubagentStop` hooks
  - Intelligent scope selection (local vs project settings)
- ✅ **Cursor AI** (`.cursor/`)
- ✅ Custom AI tool configurations

## 🏛️ Philosophy

> *"Examine yourself without mercy."*  
> *"Accept your duty as given."*  
> *"Let your work speak truth."*  
> *"Embrace failure as teacher."*

Vow brings stoic principles to AI development. It's not about controlling AI—it's about AI learning to control itself through honest self-reflection.

## 🛠️ Advanced Usage

### Git Worktrees

Vow intelligently handles git worktrees:

```bash
# In a worktree, Vow detects:
# - Main repository location
# - Worktree-specific configuration
# - Shared hooks directory

vow install  # Will offer options for worktree-only or main repo
```

### Claude Code Scope Selection

Vow offers flexible configuration for Claude Code users:

```bash
# Interactive installation shows scope options
npx -y @probelabs/vow@latest install

# When Claude Code is detected, you'll see:
# ❯ Local (settings.local.json)    [Affects only your user account]
#   Project (settings.json)        [Affects all users of this project]
```

**Scope Details:**
- **Local** (`.claude/settings.local.json`) - User-specific settings that don't affect other team members
- **Project** (`.claude/settings.json`) - Shared settings that apply to all project contributors
- **Default**: Local scope is recommended for individual accountability

### Custom Hooks Directory

If you use a custom hooks directory:

```bash
# Set custom hooks path
git config core.hooksPath ~/.git-hooks

# Vow will detect and install there
vow install
```

### Dry Run Mode

Preview changes before installation:

```bash
npx -y @probelabs/vow@latest install --dry-run
# Shows what would be changed without modifying files
```

### Uninstalling

Remove Vow from all locations:

```bash
# Using the uninstall subcommand (recommended)
npx -y @probelabs/vow@latest uninstall

# Or using install with --uninstall flag
npx -y @probelabs/vow@latest install --uninstall

# With confirmation bypass
npx -y @probelabs/vow@latest uninstall --yes
```

### Rules System

Vow uses AGENT_VOW.md for accountability rules. If no local `AGENT_VOW.md` exists in your project, the package's default AGENT_VOW.md is used automatically. This ensures AI accountability works immediately without setup.

```bash
# View current rules (local or package default)
npx -y @probelabs/vow@latest rules

# Create custom AGENT_VOW.md to override defaults
npx -y @probelabs/vow@latest rules > AGENT_VOW.md
# Then customize the generated file

# Remove local rules to use package defaults again
rm AGENT_VOW.md
npx -y @probelabs/vow@latest check  # Uses package's AGENT_VOW.md
```

## 🌐 Ecosystem

Part of the **[Probe Labs](https://probelabs.com)** ecosystem—tools dedicated to improving human and AI collaboration in engineering.

- 🧠 [Probe](https://github.com/probelabs/probe) - Intelligent code context extraction
- 🤝 **Vow** - Accountability gates for AI agents
- 🚀 More tools coming soon...

## 📄 License

MIT © [Probe Labs](https://probelabs.com)

## 🔧 Troubleshooting

### Vow not triggering in git hooks

1. Check if hooks are executable:
   ```bash
   ls -la .git/hooks/pre-commit
   # Should show executable permissions (x)
   ```

2. Verify Vow installation:
   ```bash
   npx -y @probelabs/vow@latest install --dry-run
   # Check detection results
   ```

3. For custom hooks directories:
   ```bash
   git config core.hooksPath
   # Ensure Vow is installed in the correct directory
   ```

### Worktree issues

If Vow isn't working in a worktree:

```bash
# Check worktree configuration
git worktree list

# Reinstall for the main repository
cd $(git rev-parse --git-common-dir)/..
vow install
```

### Claude Code not detecting

Vow prioritizes `.claude/settings.local.json` over `.claude/settings.json`. Ensure your settings file exists and is valid JSON:

```bash
# Check local settings (user-specific)
cat .claude/settings.local.json | jq .

# Or check project settings (shared)
cat .claude/settings.json | jq .

# Reinstall with scope selection
vow install --claude --force
```

## 🔌 Compatibility

- **Node.js**: v14 or higher
- **Git**: v2.0 or higher
- **Operating Systems**: macOS, Linux, Windows (with Git Bash)
- **Hook Managers**: Husky v4-v9, pre-commit, lefthook, simple-git-hooks
- **AI Tools**: Claude Code, Cursor AI, GitHub Copilot

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development

```bash
# Clone the repository
git clone https://github.com/probelabs/vow.git
cd vow

# Install dependencies (none currently)
npm install

# Run tests
npm test

# Deploy website
npm run deploy:site
```

## 🙏 Acknowledgments

Inspired by the need for trust in human-AI collaboration and the principles of stoic philosophy.

---

<p align="center">
  <a href="https://probelabs.com/vow/">Website</a> •
  <a href="https://github.com/probelabs/vow">GitHub</a> •
  <a href="https://www.npmjs.com/package/@probelabs/vow">npm</a>
</p>

<p align="center">
  <sub>Built with reverence in the year of our digital lord, 2025</sub>
</p>