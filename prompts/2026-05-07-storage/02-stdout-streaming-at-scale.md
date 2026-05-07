# Does stdout streaming from Docker scale for large NDJSON output?

## Executive summary

**Yes — stdout streaming is the right default for `contextractor`, including outputs in the hundreds of MB and into the low single-digit GB range, but only if (a) the user is on a recent Docker Engine (24.0.6 / containerd 1.7.3 or later), and (b) the container is run with `--log-driver=none` for very large outputs to avoid duplicating the entire stream onto the host's `/var/lib/docker` disk.** Above roughly 5–10 GB per run, or for outputs that need fault‑tolerant resumption, a bind-mounted output file (or direct upload to object storage from inside the container) becomes meaningfully better — not because the pipe itself fails, but because the default JSON-file logging driver doubles the write volume, the daemon proxy serialises everything through one goroutine, and a Ctrl‑C / SSH disconnect costs you the whole job.

The previously recommended pattern — *"stdout for data, stderr for logs, optional `-v /output` bind mount for batch runs"* — does **not** need to be revised in spirit, but it should be tightened with three concrete additions:

1. Recommend `--log-driver=none` (or at least a small `--log-opt max-size=`) whenever piping multi‑GB output to the host, to avoid the json-file driver writing a second copy of the data to disk.
2. Document the minimum supported Docker Engine version (≥ 24.0.6) because of the data-loss bug fixed by containerd PR #8643.
3. Recommend `-o /out/file.ndjson` with a bind mount as the default for outputs >~5 GB, jobs longer than ~30 minutes, or anything that needs to survive SSH/CI disconnects.

The rest of this document explains why.

---

## 1. How `docker run` actually streams stdout

When you invoke `docker run` (without `-d`) and let it write to your terminal or to a host pipe, the byte path is:

```
container PID 1 stdout fd
   ↓  (pipe to containerd-shim)
containerd-shim
   ↓  (gRPC stream to containerd / dockerd)
dockerd
   ↓  (1) writes to the configured logging driver
   ↓  (2) multiplexes to the docker CLI over the daemon's HTTP API (/containers/{id}/attach)
docker CLI
   ↓  (writes to its own stdout fd, i.e. your shell's pipe / file)
your `> big_output.ndjson` or `| jq`
```

Two things follow from this picture, both of which matter for large outputs:

- **The docker daemon is in the data path for every byte.** Even when you are piping to the host, the bytes traverse a Unix domain socket and an HTTP-style hijacked stream multiplexed with stdout/stderr framing. There is no zero‑copy path. On Docker Desktop (Mac/Windows) every byte additionally crosses the host↔Linux‑VM boundary over a virtio transport.
- **The configured logging driver always sees the data, even when you are attached interactively.** With the default `json-file` driver this means **every byte your tool writes to stdout is also being written to `/var/lib/docker/containers/<id>/<id>-json.log` on the host**. That file is JSON-wrapped (`{"log":"…","stream":"stdout","time":"…"}`), so the on-disk amplification is roughly **2×** the raw byte count plus per-line metadata.

The `local` logging driver is more efficient and rotates by default, capping per-container log usage at 100 MB (5 × 20 MB). It is the recommended default in modern Docker but is *not* the actual default on most systems because Docker keeps `json-file` for backwards compatibility.

`--log-driver=none` disables this entirely. The container's stdout/stderr is still captured by the shim and still streams to your attached `docker run`, but nothing is written to a host log file and `docker logs <id>` no longer works. This is the single most important flag for large stdout streams.

## 2. The "is data lost on the wire?" question — yes, on old engines

There is a well-known Moby bug ([moby/moby #45689](https://github.com/moby/moby/issues/45689)) where `docker run`'s stdout is **truncated** if the host consumer is slower than the producer.

**Fix:** [containerd PR #8643](https://github.com/containerd/containerd/pull/8643), shipped in containerd 1.7.3 and bundled into **Docker Engine 24.0.6** (released October 2023). For any host running an older engine, stdout streaming is **not** safe at any size — it can silently truncate.

A separate, much older class of bugs exists when the container itself buffers stdout. With block-buffered libc/Python stdout in non-TTY mode, the last partially-filled 8 KiB block is only flushed when the process exits cleanly. A SIGKILL (OOM, `docker kill`) or an unclean container exit will lose the tail of the buffer. This is why:

- Python apps inside Docker should set `ENV PYTHONUNBUFFERED=1`.
- C / Go programs that use `fwrite`/`fmt.Print` should call `fflush`/`bufio.Writer.Flush()` after each NDJSON line.
- Allocating a TTY with `-t` makes libc's stdout *line-buffered* but combines stdout and stderr into one stream and adds CR/LF mangling; **do not use `-t` when streaming NDJSON for downstream parsing**.

## 3. Pipe-level backpressure and partial-output recoverability

A Linux pipe is a 64 KiB ring buffer. When the consumer is slower than the producer:

- The producer's `write(2)` blocks once the pipe is full — this is the desired backpressure and works correctly through the docker daemon's hijacked stream once the containerd 1.7.3 fix is in place.
- If the consumer dies, the producer's next `write` returns `EPIPE` and the kernel sends `SIGPIPE`. Partial data already flushed to the file is intact up to the last completed pipe write.

**NDJSON's recoverability is a genuine reliability advantage here.** A killed `docker run … > out.ndjson` leaves a file that is parseable up to the last `\n`; a partially written aggregated JSON document (single top-level array) is not. **Whatever you ship in `contextractor`, prefer NDJSON over a single JSON document for any output that might be large or interrupted.**

## 4. The logging-driver "double write" problem

This is the issue that most surprises users at scale. With Docker's default `json-file` driver and no rotation:

- A 5 GB NDJSON output piped into `> out.ndjson` results in roughly **10 GB written to the host disk**.
- On Docker Desktop, that second file lives inside the Linux VM's virtual disk image (`Docker.raw` on Mac), which means the VM disk grows by the size of the run.
- Setting `--log-driver=none` eliminates the second write entirely. The trade-off is that `docker logs <id>` no longer works for the run.

Recommended one‑liner pattern for multi-GB runs:

```bash
docker run --rm \
  --log-driver=none \
  ghcr.io/yourorg/contextractor:latest <args> \
  > big_output.ndjson 2> contextractor.log
```

## 5. The `mode=non-blocking` foot-gun

`--log-opt mode=non-blocking` puts an in-memory ring buffer (default 1 MB) between the container and the logging driver. **For a CLI tool emitting NDJSON to stdout, do not enable non-blocking mode.** If the buffer fills, Docker silently drops messages, which is unacceptable for a data-extraction tool.

## 6. Reliability behaviour under failure

| Failure | Stdout-stream behaviour | Bind-mount-write behaviour |
|---|---|---|
| User Ctrl-C of `docker run` | Container exits; partial NDJSON file is intact up to last `\n` flushed before SIGPIPE | Same: container exits, file on disk is intact up to last `write()` syscall |
| SSH disconnect | docker CLI receives SIGHUP, propagates to container; partial output is what made it through the pipe before the CLI died | Container keeps running until `docker stop` because nothing is attached to its stdout |
| Docker daemon restart mid-run | Container is killed; output truncated | If Live Restore is enabled, the container survives daemon restart and the bind-mounted file keeps growing |
| Container OOM | libc/Python unflushed buffers lost; pipe data already passed to host is intact | File on disk is intact up to last successful `write()` |
| Consumer (`jq`, `gzip`) crashes | `SIGPIPE` to docker CLI; container exits with broken-pipe error; partial output already written downstream | Not applicable; container keeps writing to the bind-mount file |

The last row is the most important real-world distinction: **a bind-mounted file decouples the container from the host-side pipeline.**

## 7. Concrete thresholds for `contextractor`

| Output size | Recommendation |
|---|---|
| < 100 MB | Pipe to stdout. Don't bother with flags. |
| 100 MB – 1 GB | Pipe to stdout. Add `--log-driver=none` if running on a host where `/var/lib/docker` is small. Compress on the fly: `… \| gzip > out.ndjson.gz`. |
| 1 – 10 GB | Pipe to stdout **with** `--log-driver=none`. Verify Docker Engine ≥ 24.0.6. Strongly consider `\| zstd -T0 > out.ndjson.zst`. |
| 10 GB – 100 GB | Use a bind mount (`-v $PWD/out:/out`) and have the tool write to `/out/file.ndjson` directly with `-o`. |
| > 100 GB | Stream directly to S3 / GCS / Azure Blob via multipart upload from inside the container. |

For Docker Desktop (Mac/Windows) specifically: at sizes above ~2 GB, prefer the bind-mount path over stdout because the VM-boundary overhead becomes noticeable, but be aware of the VirtioFS >2 GB seek bug if downstream tooling reads the file from another container.

## 8. Sample commands

**Default case (small/medium output, anywhere up to ~1 GB):**

```bash
docker run --rm ghcr.io/yourorg/contextractor:latest \
  https://example.com/sitemap.xml \
  > out.ndjson 2> extract.log
```

**Multi-GB stream to local file, no stdout copy on host disk:**

```bash
docker run --rm \
  --log-driver=none \
  ghcr.io/yourorg/contextractor:latest \
  https://example.com/sitemap.xml \
  > out.ndjson 2> extract.log
```

**Very-large or long-running batch (bind mount):**

```bash
mkdir -p out
docker run --rm \
  --log-driver=none \
  -v "$PWD/out:/out" \
  ghcr.io/yourorg/contextractor:latest \
  -o /out/extract.ndjson \
  https://example.com/sitemap.xml \
  2> out/extract.log
```

## 9. Pitfalls

1. **Old Docker Engine (<24.0.6) silently truncates stdout under load.** Document the minimum version.
2. **The default `json-file` log driver doubles disk usage.** Either set `--log-driver=none` per-run, or set `daemon.json` to `{"log-driver":"local","log-opts":{"max-size":"100m"}}` once.
3. **`-t` (TTY) corrupts NDJSON streams.** Never use `-t` for data output.
4. **Python output buffering loses the tail of the stream on SIGKILL/OOM.** Set `ENV PYTHONUNBUFFERED=1` in the Dockerfile.
5. **`mode=non-blocking` silently drops data lines.** Never enable for a data tool.
6. **`-d` (detached) mode does not stream to your terminal.** The data goes only to the logging driver.
7. **`docker run … > out.ndjson` runs `>` on the *client* shell** — it does not need a bind mount.
8. **macOS bind mounts on VirtioFS have a documented bug for file operations beyond 2 GiB.**
9. **Compression is almost always a win at scale.** zstd -3 reduces the bytes the daemon must proxy by 4–6× on typical web-text NDJSON.
10. **stderr is *not* rate-limited or buffered the same way as stdout.** Verbose progress logs to stderr can themselves become multi-GB if the tool is chatty.

## 10. Verdict on the previous recommendation

The recommendation — *"stdout for data, stderr for logs, optional `-v /output` bind mount for batch runs"* — is **fundamentally correct** and survives close examination at scale. The only refinements needed:

- Promote `--log-driver=none` from "nice optimization" to a **default-recommended flag for any stream expected to exceed ~1 GB**.
- State a **minimum supported Docker Engine version of 24.0.6**.
- Add clear **threshold guidance** (the table in §7).
- Warn explicitly about `-t`, `mode=non-blocking`, and Python's default block buffering.
