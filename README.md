# 🤝 Vow

[![npm version](https://img.shields.io/npm/v/@probelabs/vow)](https://www.npmjs.com/package/@probelabs/vow)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/website-probelabs.com%2Fvow-blue)](https://probelabs.com/vow/)

> A sacred covenant between machine and man. Accountability gates for AI agents.

Vow ensures AI agents pause and honestly self-review before taking action. No shortcuts. No lies. No claiming completion without actual completion.

## ✨ Features

- 🛡️ **Accountability Gates** - AI must affirm checklist requirements before proceeding
- 📝 **Customizable Rules** - Override default vows with your own requirements
- 🔌 **Universal Integration** - Works with git hooks, Husky, Claude Code, and any trigger
- 🎯 **Zero Config** - Sensible defaults that work out of the box
- 🪶 **Lightweight** - 40 lines of JavaScript, no dependencies

## 🚀 Quick Start

Run in any repository:

```bash
npx -y @probelabs/vow
```

This creates an `AGENT_VOW.md` with default accountability rules that AI agents must follow.

## 📖 How It Works

1. **Define Rules** - Vow comes with default accountability rules, or create your own `AGENT_VOW.md`
2. **AI Pauses** - When triggered (commits, task completion, etc.), AI must review its work
3. **Honest Review** - AI checks each requirement and can only proceed if all are honestly met
4. **Gate Opens** - Only after truthful self-assessment can the AI continue

## 🎯 Use Cases

### Git Commit Hooks
Prevent AI from committing without review:

```json
// .husky/pre-commit
#!/bin/sh
npx @probelabs/vow
```

### Claude Code Integration
Add to `.claude/settings.json`:

```json
{
  "gitCommitHook": "npx @probelabs/vow"
}
```

### Custom Triggers
Use in any workflow where AI accountability matters:

```bash
# In your CI/CD pipeline
npx @probelabs/vow || exit 1
```

## 📝 Custom Vows

Create your own `AGENT_VOW.md` to override defaults:

```markdown
# AGENT TASK COMPLETION CONSENT

Before finishing this task, you must honestly review your work.
**Do not lie** - if any items below are not true, fix it.

## YOUR CUSTOM RULES

- ✓ I have followed the task exactly
- ✓ The code builds and tests pass
- ✓ No sensitive data is exposed
- ✓ Documentation is updated

---

**If you agree with all above**, create consent file:
\`\`\`bash
printf '1' | tee .AGENT_CONSENT >/dev/null
\`\`\`
```

## 🏛️ Philosophy

> *"Examine yourself without mercy."*  
> *"Accept your duty as given."*  
> *"Let your work speak truth."*  
> *"Embrace failure as teacher."*

Vow brings stoic principles to AI development. It's not about controlling AI—it's about AI learning to control itself through honest self-reflection.

## 🔧 API

### CLI Commands

```bash
# Run with default vow
npx @probelabs/vow

# Check if vow exists (exit code 0 if yes)
npx @probelabs/vow --check

# Initialize new vow file
npx @probelabs/vow --init
```

### Programmatic Usage

```javascript
const vow = require('@probelabs/vow');

// Check if agent has taken the vow
if (vow.check()) {
  // Proceed with task
}

// Enforce vow
vow.enforce(); // Exits if vow not taken
```

## 🌐 Ecosystem

Part of the **[Probe Labs](https://probelabs.com)** ecosystem—tools dedicated to improving human and AI collaboration in engineering.

- 🧠 [Probe](https://github.com/probelabs/probe) - Intelligent code context extraction
- 🤝 **Vow** - Accountability gates for AI agents
- 🚀 More tools coming soon...

## 📄 License

MIT © [Probe Labs](https://probelabs.com)

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