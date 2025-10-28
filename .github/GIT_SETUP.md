# Git Setup Guide

## Overview

This project includes comprehensive Git configuration files to ensure consistent development across all platforms.

## Files Included

### 📄 `.gitignore`
Prevents committing sensitive, generated, or unnecessary files:
- Environment files (`.env`, `.env.local`, etc.)
- Build artifacts (`dist/`, `target/`, `node_modules/`)
- Database files (`*.db`, `*.sqlite`)
- IDE configuration (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`, `Thumbs.db`)
- Logs and temporary files

### 📄 `.gitattributes`
Ensures consistent line endings across platforms:
- **LF** (Unix) for source code, scripts, configs
- **CRLF** (Windows) for `.bat`, `.cmd`, `.ps1` files
- Binary files marked correctly
- Rust diff driver configured

### 📄 `.dockerignore`
Optimizes Docker builds by excluding:
- Version control files
- Documentation
- Development dependencies
- IDE configurations
- Test files

### 📄 `.editorconfig`
Consistent code formatting across editors:
- UTF-8 encoding
- LF line endings
- Trailing whitespace removal
- Proper indentation (2 spaces for JS/TS, 4 for Rust)

## First-Time Setup

### 1. Normalize Line Endings

If you've already cloned the repository before these files existed:

```bash
# Remove the index (cached files)
git rm --cached -r .

# Re-normalize line endings
git reset --hard

# Add all files back with correct line endings
git add .
```

### 2. Configure Git (Windows Users)

```bash
# Set Git to use LF but checkout as-is
git config --global core.autocrlf input

# Or for this repository only:
git config core.autocrlf input
```

### 3. Install EditorConfig Plugin

- **VS Code**: Install "EditorConfig for VS Code"
- **IntelliJ/WebStorm**: Built-in support
- **Sublime Text**: Install EditorConfig package
- **Vim**: Install editorconfig-vim

## Verification

### Check Line Endings

```bash
# Check a file's line endings
file backend/src/main.rs

# Should show: "UTF-8 Unicode text"
# NOT: "UTF-8 Unicode text, with CRLF line terminators"
```

### Check Git Status

```bash
git status

# Should show clean working tree if everything is normalized
```

### Test .gitignore

```bash
# Create test files that should be ignored
touch .env
touch database.db
mkdir node_modules

git status

# These should NOT appear in untracked files
```

## Common Issues

### Issue: Files show as modified after checkout

**Cause:** Line ending mismatch

**Solution:**
```bash
git config core.autocrlf input
git rm --cached -r .
git reset --hard
```

### Issue: `.env` file accidentally committed

**Cause:** File was committed before `.gitignore` existed

**Solution:**
```bash
# Remove from Git but keep local file
git rm --cached .env

# Commit the removal
git commit -m "Remove .env from repository"

# File remains locally but won't be tracked
```

### Issue: Large files increase repository size

**Cause:** Binary files committed (databases, logs, etc.)

**Solution:**
```bash
# Remove from history (careful!)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch database.db' \
  --prune-empty --tag-name-filter cat -- --all

# Or use BFG Repo-Cleaner (recommended)
# https://rtyley.github.io/bfg-repo-cleaner/
```

## Security Best Practices

### ⚠️ Never Commit

- `.env` files with real secrets
- Database files with production data
- SSL certificates or private keys
- API keys or passwords
- User data

### ✅ Safe to Commit

- `.env.example` (template files)
- `.env.docker.example` (examples)
- Public configuration
- Documentation
- Source code

## Maintenance

### Updating .gitignore

After updating `.gitignore`, remove cached files:

```bash
git rm -r --cached .
git add .
git commit -m "Update .gitignore"
```

### Checking What's Ignored

```bash
# List all ignored files
git status --ignored

# Check if specific file would be ignored
git check-ignore -v filename.txt
```

## Platform-Specific Notes

### Windows

- Use Git Bash or WSL for best compatibility
- EditorConfig plugin respects `.editorconfig`
- `.bat` files use CRLF (correct for Windows)

### macOS/Linux

- Native support for LF line endings
- Shell scripts (`.sh`) always use LF
- No special configuration needed

### Docker Containers

- Always use LF inside containers
- `.dockerignore` optimizes build context
- Mounted volumes respect host OS line endings

## Resources

- [gitignore.io](https://www.toptal.com/developers/gitignore) - Generate .gitignore files
- [EditorConfig](https://editorconfig.org/) - Editor configuration
- [Git Attributes](https://git-scm.com/docs/gitattributes) - Git attributes documentation
- [GitHub: Dealing with line endings](https://docs.github.com/en/get-started/getting-started-with-git/configuring-git-to-handle-line-endings)

## Questions?

If you encounter issues with Git configuration, check:
1. Git version: `git --version` (use >= 2.30)
2. Editor plugin installed
3. Line ending configuration: `git config --get core.autocrlf`
4. File status: `git ls-files --eol`
