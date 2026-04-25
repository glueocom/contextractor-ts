---
name: async-rust-patterns
description: Advanced async/await patterns with tokio for high-performance Rust applications. Use when writing async Rust code that involves concurrency, cancellation, retries, rate limiting, or sync/async boundaries.
---

# Async Rust Patterns

Idiomatic patterns for async Rust on tokio 1.x.

## Runtime Setup

```rust
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    run().await
}
```

Use `#[tokio::main(flavor = "multi_thread")]` (the default) for I/O-heavy work, `#[tokio::main(flavor = "current_thread")]` for single-threaded use cases.

Never construct a runtime inside library code — runtimes belong at the binary entry point.

## Structured Concurrency

### Fixed-arity fan-out

```rust
use tokio::try_join;

let (a, b, c) = try_join!(fetch_a(), fetch_b(), fetch_c())?;
```

### Dynamic fan-out

```rust
use tokio::task::JoinSet;

let mut set = JoinSet::new();
for url in urls {
    set.spawn(fetch(url));
}
while let Some(result) = set.join_next().await {
    let value = result??;
    handle(value);
}
```

### First-of

```rust
use tokio::select;

select! {
    msg = receiver.recv() => handle(msg),
    _ = tokio::time::sleep(Duration::from_secs(5)) => bail!("timeout"),
}
```

### Streaming

```rust
use futures::stream::{FuturesUnordered, StreamExt};

let mut stream = FuturesUnordered::new();
for item in items { stream.push(process(item)); }
while let Some(result) = stream.next().await { ... }
```

For pull-based streaming, use `async_stream::stream! { ... }`.

## Rate Limiting

```rust
use std::sync::Arc;
use tokio::sync::Semaphore;

let semaphore = Arc::new(Semaphore::new(10));
let permit = semaphore.clone().acquire_owned().await?;
let result = make_request().await;
drop(permit);
```

Bound concurrency on every external resource — never let `JoinSet` or `FuturesUnordered` grow without limit.

## Timeouts

```rust
use tokio::time::{timeout, Duration};

let response = timeout(Duration::from_secs(30), client.get(url).send()).await??;
```

Wrap every external I/O call with a timeout, either at the call site or at the client level (`reqwest::Client::builder().timeout(...)`).

## Retry with Backoff

```rust
use backoff::{ExponentialBackoff, future::retry};

let result = retry(ExponentialBackoff::default(), || async {
    fetch().await.map_err(backoff::Error::transient)
}).await?;
```

`tokio-retry` is also fine for simpler cases.

## Sync / Async Boundary

```rust
use tokio::task;

let parsed = task::spawn_blocking(move || expensive_sync_parse(&blob)).await??;
```

CPU-bound work, blocking I/O, and any sync API that may hold the thread for >100µs must run inside `spawn_blocking`. Otherwise it stalls the runtime.

## Tracing

```rust
use tracing::{info, instrument};

#[instrument(skip(client), fields(url = %req.url))]
async fn fetch(client: &reqwest::Client, req: Request) -> anyhow::Result<Response> {
    info!("starting fetch");
    client.execute(req.into()).await.map_err(Into::into)
}
```

`#[tracing::instrument]` adds the function's args as span fields. Use `skip(...)` for large or non-Display arguments.

## Cancellation

`tokio::task::JoinHandle::abort()` cancels a task at the next `.await` point. `tokio_util::task::AbortOnDropHandle` aborts when the handle is dropped — useful for scoped tasks.

## Anti-Patterns

- Sync I/O inside async functions without `spawn_blocking` — stalls the runtime
- Building a `tokio::runtime::Runtime` inside library code — caller should provide it
- Holding a `MutexGuard`, `RefCell::borrow()`, or `RwLock` guard across `.await` — deadlocks waiting
- Calling `tokio::runtime::Handle::block_on` inside async code — deadlocks the current worker
- Unbounded `FuturesUnordered` or `JoinSet` — exhausts memory and downstream resources
