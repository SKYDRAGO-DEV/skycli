# skycli

> Blazing fast CLI tool for developer productivity — 10x your workflow

[![npm](https://img.shields.io/npm/v/skycli)](https://npmjs.com/package/skycli)
[![Build](https://img.shields.io/github/actions/workflow/status/SKYDRAGO-DEV/skycli/ci.yml)](https://github.com/SKYDRAGO-DEV/skycli/actions)
[![Downloads](https://img.shields.io/npm/dm/skycli)](https://npmjs.com/package/skycli)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- ⚡ **10x Faster** — Optimized for speed with lazy loading and caching
- 🎯 **Smart Autocomplete** — Context-aware suggestions powered by ML
- 🔄 **Cross-Platform** — Windows, macOS, Linux support
- 🔌 **Plugin System** — Extend functionality with custom plugins
- 📦 **Universal** — npm, yarn, pnpm, bun support out of the box

## Install

```bash
npm install -g skycli
```

## Usage

```bash
# Interactive mode
sky

# Direct commands
sky deploy --env production
sky init my-project --template react-ts
sky search "async await patterns"
sky config set theme dracula
```

## Commands

| Command | Description |
|---------|-------------|
| `sky init` | Initialize new project |
| `sky deploy` | Deploy to cloud |
| `sky search` | Search documentation |
| `sky config` | Manage configuration |
| `sky plugins` | Plugin management |

## Architecture

```
src/
├── cli/          # Command-line interface layer
├── core/         # Core engine & logic
├── plugins/      # Plugin system
└── utils/        # Shared utilities
```

## License

MIT © SKYDRAGO-DEV

