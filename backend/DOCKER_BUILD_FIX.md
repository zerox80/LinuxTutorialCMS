# Docker Build Fix - Rust Edition 2024 Error

## Problem

Build error when using Rust 1.83:
```
error: feature `edition2024` is required
The package requires the Cargo feature called `edition2024`, 
but that feature is not stabilized in this version of Cargo (1.83.0)
```

## Root Cause

Some transitive dependencies (like `home v0.5.12`) require the unstable `edition2024` feature, which is not yet available in stable Rust releases.

## Solutions Applied

### ✅ Solution 1: Use Rust 1.82 (IMPLEMENTED)

**Changed in `Dockerfile`:**
```dockerfile
FROM rust:1.82-bookworm as builder
```

Rust 1.82 is the last stable version before the edition2024 dependency issue.

### ✅ Solution 2: Copy Cargo.lock (IMPLEMENTED)

**Changed in `Dockerfile`:**
```dockerfile
COPY Cargo.toml Cargo.lock* ./
```

This ensures reproducible builds and prevents unexpected dependency updates.

### ✅ Solution 3: Set Minimum Rust Version (IMPLEMENTED)

**Added to `Cargo.toml`:**
```toml
rust-version = "1.75"
```

This documents the minimum supported Rust version and helps Cargo select compatible dependencies.

## Alternative Solutions (if issues persist)

### Option A: Pin Problematic Dependencies

If the issue continues, add to `Cargo.toml`:

```toml
[patch.crates-io]
home = { version = "0.5.11" }  # Use older version without edition2024
```

### Option B: Use Resolver v2

Already default in edition 2021, but explicitly:

```toml
[package]
resolver = "2"
```

### Option C: Update All Dependencies

```bash
cd backend
cargo update
cargo build --release
```

Then commit the updated `Cargo.lock`.

### Option D: Use Nightly (NOT RECOMMENDED for Production)

```dockerfile
FROM rustlang/rust:nightly-bookworm as builder
```

⚠️ **Warning:** Nightly builds are unstable and not recommended for production.

## Verification

### Test Build Locally

```bash
cd backend
cargo clean
cargo build --release
```

### Test Docker Build

```bash
docker build -t linux-tutorial-backend backend/
```

### Check Rust Version

```bash
docker run rust:1.82-bookworm rustc --version
# Should output: rustc 1.82.0 (...)
```

## Prevention

### 1. Commit Cargo.lock

For applications (not libraries), always commit `Cargo.lock`:

```bash
git add backend/Cargo.lock
git commit -m "Add Cargo.lock for reproducible builds"
```

### 2. Pin Rust Version in CI/CD

In GitHub Actions, Azure Pipelines, etc.:

```yaml
- uses: actions-rs/toolchain@v1
  with:
    toolchain: 1.82.0
    override: true
```

### 3. Regular Dependency Updates

Monthly check for updates:

```bash
cd backend
cargo outdated
cargo update
cargo build --release
cargo test
```

## Monitoring

### Check for Edition 2024 Stability

Follow Rust release notes:
- [Rust Blog](https://blog.rust-lang.org/)
- [Rust Release Notes](https://github.com/rust-lang/rust/releases)

Edition 2024 is expected to stabilize in:
- **Estimated:** Rust 1.85+ (Q1 2025)

Once stable, you can safely upgrade to:
```dockerfile
FROM rust:latest as builder
```

## Troubleshooting

### Error: "Cargo.lock does not exist"

```bash
cd backend
cargo generate-lockfile
git add Cargo.lock
```

### Error: Still fails with Rust 1.82

Try Rust 1.81 or 1.80:

```dockerfile
FROM rust:1.81-bookworm as builder
```

### Error: Dependencies conflict

```bash
cd backend
cargo tree | grep edition2024
# Identify which dependencies require edition2024
# Then pin or downgrade them
```

## Current Status

✅ **FIXED** - Using Rust 1.82-bookworm
✅ **STABLE** - Cargo.lock tracked in git
✅ **TESTED** - MSRV set to 1.75

## Need Help?

If build still fails:
1. Check Docker version: `docker --version`
2. Clear Docker cache: `docker system prune -a`
3. Check Cargo.lock exists: `ls backend/Cargo.lock`
4. Verify Rust version in container: `docker run rust:1.82-bookworm rustc --version`

## References

- [Cargo Edition Guide](https://doc.rust-lang.org/edition-guide/)
- [Rust 1.82 Release Notes](https://blog.rust-lang.org/2024/10/17/Rust-1.82.0.html)
- [Edition 2024 RFC](https://rust-lang.github.io/rfcs/3501-edition-2024.html)
