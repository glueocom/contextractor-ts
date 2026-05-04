# Local Maintenance Test Report

**Date**: 2026-05-03  
**Repository**: `/Users/miroslavsekera/r/contextractor-ts/`  
**Branch**: dev

## Build Results

### TypeScript Build
- **Status**: PASS
- **Tool**: turbo
- **Packages**: 14 total, 10 cached
- **Duration**: 40ms
- **Output**: All packages compiled successfully

### Rust Build
- **Status**: PASS
- **Tool**: cargo build --workspace
- **Duration**: 0.15s
- **Output**: Finished dev profile unoptimized + debuginfo

## Test Results

### TypeScript Unit Tests (pnpm test)
- **Status**: PASS
- **Test Runner**: vitest via turbo
- **Total Tests**: 64 passed, 0 failed

Test breakdown by package:
- `@contextractor/schema`: 2 test files, 19 tests passed
- `@contextractor/extraction`: 2 test files, 16 tests passed
- `@contextractor/standalone`: 2 test files, 16 tests passed
- `@contextractor/gen-md-regions`: 2 test files, 13 tests passed
- `@contextractor/apify`: 0 tests (no test files)
- `@contextractor/crawler`: 0 tests (no test files)
- `@contextractor/opencode-sync`: 0 tests (no test files)
- `@contextractor/gen-input-schema`: 0 tests (no test files)

### Rust Tests (cargo test --workspace)
- **Status**: PASS
- **Total Tests**: 5 passed, 0 failed
- **Duration**: 0.02s

Test breakdown:
- `unknown_format_is_rejected`: PASS
- `extract_txt_returns_non_empty_content`: PASS
- `extract_metadata_populates_some_fields`: PASS
- `extract_markdown_returns_non_empty_content`: PASS
- `extract_all_formats_returns_four_keys`: PASS

## Code Quality

### Biome Linting
- **Status**: PASS
- **Files Checked**: 777
- **Duration**: 183ms
- **Issues Fixed**: 0
- **Output**: No fixes applied

### Clippy Lint (Rust)
- **Status**: PASS
- **Duration**: 0.15s
- **Warnings**: 0
- **Output**: Finished dev profile with no errors

## Code Formatting

### Cargo Formatting
- **Status**: PASS
- **Duration**: ~5ms
- **Files Formatted**: All Rust files
- **Changes**: None needed

### TypeScript/JavaScript Formatting
- **Status**: PASS
- **Duration**: 122ms
- **Files Formatted**: 777
- **Changes**: None needed

## Summary

- Format and lint: **PASS** (all 4 checks)
- Unit tests: **PASS** (64 TypeScript + 5 Rust = 69 total)
- Integration tests: Skipped (no external site access)
- Build: **PASS** (TypeScript + Rust)

**Overall Status**: All maintenance checks completed successfully. No issues found. No code changes required.
