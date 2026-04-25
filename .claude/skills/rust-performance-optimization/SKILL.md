---
name: rust-performance-optimization
description: Performance profiling, optimization techniques, and bottleneck identification for high-performance Rust applications. Use when measuring, profiling, or optimizing hot paths.
---

# Rust Performance Optimization

Tools and techniques for measuring and improving Rust performance.

## Profile First, Optimize Second

Always measure before changing code. Optimizing without a profile is guesswork.

## Profiling Tools

### CPU profiling — `cargo flamegraph`

```bash
cargo install flamegraph
cargo flamegraph --bin contextractor -- --url https://example.com
```

Opens a flamegraph SVG in your browser. The widest stack frames are your hot paths.

### Microbenchmarks — `criterion`

```toml
[dev-dependencies]
criterion = "0.5"

[[bench]]
name = "extract"
harness = false
```

```rust
// benches/extract.rs
use criterion::{criterion_group, criterion_main, Criterion};

fn bench_extract(c: &mut Criterion) {
    let html = include_str!("../tests/fixtures/sample.html");
    c.bench_function("extract", |b| b.iter(|| extract(html)));
}

criterion_group!(benches, bench_extract);
criterion_main!(benches);
```

```bash
cargo bench
```

### Heap profiling — `dhat-heap`

```toml
[dependencies]
dhat = { version = "0.3", optional = true }

[features]
dhat-heap = ["dep:dhat"]
```

```rust
#[cfg(feature = "dhat-heap")]
#[global_allocator]
static ALLOC: dhat::Alloc = dhat::Alloc;

fn main() {
    #[cfg(feature = "dhat-heap")]
    let _profiler = dhat::Profiler::new_heap();
    // ... rest of main
}
```

```bash
cargo run --features dhat-heap
```

### Instruction-level — `iai-callgrind`

```toml
[dev-dependencies]
iai-callgrind = "0.14"
```

Lower-noise alternative to criterion for micro-optimizations. Requires `valgrind` installed.

## Common Wins

### Iterators over manual loops

```rust
let sum: u32 = items.iter().map(|i| i.weight).sum();    // good
```

The compiler optimizes iterator chains well; manual loops often disable that.

### Cache expensive computations with `OnceLock`

```rust
use std::sync::OnceLock;

static REGEX: OnceLock<regex::Regex> = OnceLock::new();
fn email_regex() -> &'static regex::Regex {
    REGEX.get_or_init(|| regex::Regex::new(r"[\w.+-]+@[\w.-]+").unwrap())
}
```

### Pre-allocate strings and vectors

```rust
let mut buf = String::with_capacity(items.len() * 16);
for item in &items { buf.push_str(&item.name); buf.push(','); }

// Or simpler:
let csv = items.iter().map(|i| i.name.as_str()).collect::<Vec<_>>().join(",");
```

### Faster hash maps

For non-cryptographic keys, swap `HashMap` for `FxHashMap` or `AHashMap`:

```toml
[dependencies]
ahash = "0.8"
```

```rust
use ahash::AHashMap;
let mut counts: AHashMap<&str, u32> = AHashMap::new();
```

Order of magnitude faster than the default SipHash-based `HashMap`.

### Avoid unnecessary clones with `Cow`

```rust
use std::borrow::Cow;

fn normalize(s: &str) -> Cow<'_, str> {
    if s.contains(' ') { Cow::Owned(s.replace(' ', "_")) } else { Cow::Borrowed(s) }
}
```

### Share immutable data with `Arc`

```rust
let config = Arc::new(load_config()?);
for url in urls {
    let config = Arc::clone(&config);
    tokio::spawn(async move { process(url, config).await });
}
```

### Parallel iteration with `rayon`

```toml
[dependencies]
rayon = "1"
```

```rust
use rayon::prelude::*;

let results: Vec<_> = inputs.par_iter().map(expensive_transform).collect();
```

For CPU-bound work only — never inside an async context without `spawn_blocking`.

## Release Profile

```toml
[profile.release]
lto = "fat"
codegen-units = 1
panic = "abort"
strip = "symbols"
opt-level = 3
```

`lto = "fat"` and `codegen-units = 1` give the optimizer the whole program, at the cost of longer compile times.

## SIMD

For numerically-heavy workloads, use `wide` for portable SIMD:

```toml
[dependencies]
wide = "0.7"
```

Or `std::simd` on nightly for the in-progress portable SIMD API.
