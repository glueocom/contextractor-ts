# Storing Output Data for a Dockerized CLI Tool: Best Practices and Recommendations for `contextractor`

> A comprehensive, opinionated reference for designing the output-storage UX of the `contextractor` Docker image, distilled from the conventions used by pandoc, ffmpeg, hadolint, singlefile, yt-dlp, aws-cli, Crawlee/Playwright, Apify CLI, and trafilatura itself.

---

## 1. Executive summary — recommended pattern for `contextractor`

For a CLI tool whose primary job is to extract structured content (JSON / Markdown / occasionally HTML or screenshots) from URLs and whose Docker image is intended for **standalone local developer use**, the recommended canonical pattern is a **hybrid stdout-first + bind-mount output directory** model:

1. **Default behaviour: write a single document to stdout.** A user running `docker run --rm contextractor https://example.com` should get a usable JSON or Markdown document on stdout that they can pipe (`| jq`, `> file.md`) without needing to understand Docker volumes. Logs and progress go to **stderr** so they don't pollute the data stream.
2. **When `--output-dir` (or `-o`) is passed, write to `/output` inside the container.** That path is documented as the canonical mount point and users bind-mount their host directory there: `-v "$(pwd)/output:/output"`.
3. **Run as a non-root user inside the image, and document `--user "$(id -u):$(id -g)"`** (or use `fixuid` / a small entrypoint shim) so files written to bind mounts on Linux are owned by the host user, not root.
4. **Never write meaningful output to the container's writable layer.** Anything not on stdout or in `/output` is ephemeral by design.
5. **For batched URL runs, write one file per URL plus a `manifest.json` index** in the output directory, mirroring the conventions of trafilatura's own `-o OUTPUTDIR` mode.
6. **Document a tested `docker run` line for Linux/macOS (`$(pwd)`), PowerShell (`${PWD}`), and `cmd.exe` (`%cd%`)**, and ship a `docker-compose.yml` and a thin `contextractor` wrapper script for users who want to avoid the long flag string.

The rest of this document explains the alternatives, the rationale, and the gotchas.

---

## 2. The five storage strategies, compared

| Strategy | Persists after container exit? | Cross-platform DX | Composes with Unix pipes | Permission pain on Linux | Best for |
|---|---|---|---|---|---|
| Inside container/image layer | ❌ Lost on `docker rm` | n/a | n/a | n/a | Almost never (anti-pattern) |
| **Bind mount** (`-v $(pwd)/out:/output`) | ✅ on host | Path-syntax differs Win/PS/sh | ❌ | ⚠️ root-owned files unless `--user`/`fixuid` | Multi-file output, batch runs |
| Named Docker volume (`-v ctx_out:/output`) | ✅ in `/var/lib/docker/volumes/` | Same syntax everywhere | ❌ | ✅ no host UID issues | Repeated runs, opaque storage |
| **Stdout streaming** (`docker run … > file`) | n/a — written by host shell | ✅ identical everywhere | ✅ | ✅ none | Single-document output, pipelines |
| Hybrid (stdout default + optional `-o /output`) | Both | ✅ | ✅ when stdout | Same as bind mount when used | **CLI tools like `contextractor`** |

### 2.1 Storing inside the container/image — almost always wrong

Anything written to the container's writable layer disappears the moment the container is removed (`docker run --rm` removes it immediately on exit, which is the recommended default). Even without `--rm`, the data lives only inside that one container instance and is invisible to the host without `docker cp`. Docker's own documentation explicitly recommends bind mounts or volumes "when you want to create or generate files in a container and persist the files onto the host's filesystem."

There is one narrow case where writing inside the container is acceptable: ephemeral scratch space (e.g. trafilatura's own internal LXML temp files) that you never want the user to see. For that, either rely on the writable layer (fine for small temp data) or, better, mount a `tmpfs` so even kernel‑level RAM is used and the tool can run with `--read-only`:

```bash
docker run --rm --read-only --tmpfs /tmp contextractor https://example.com
```

Image-size implications: every file you write inside the running container is on the writable layer, not the image, so it does **not** bloat your published image. But baking large default datasets into the image (via `COPY` in the Dockerfile) does inflate the registry pull and is a separate anti-pattern.

### 2.2 Bind mounts — the dominant convention

Almost every popular Dockerized CLI uses bind mounts for output:

| Tool | Canonical mount path | Example invocation |
|---|---|---|
| pandoc/core | `/data` (also the WORKDIR) | `docker run --rm -v "$(pwd):/data" -u $(id -u):$(id -g) pandoc/core README.md -o README.html` |
| jrottenberg/ffmpeg | `$(pwd):$(pwd) -w $(pwd)` (mirror host path) or `/data` | `docker run --rm -v $(pwd):/data jrottenberg/ffmpeg -i /data/in.mp4 /data/out.avi` |
| amazon/aws-cli | `/aws` (the WORKDIR) + `/root/.aws` for creds | `docker run --rm -ti -v ~/.aws:/root/.aws -v $(pwd):/aws amazon/aws-cli s3 cp s3://… .` |
| capsulecode/singlefile | `/usr/src/app/out` | `docker run -v $(pwd):/usr/src/app/out singlefile "https://wikipedia.org" wiki.html` |
| jim60105/yt-dlp | `/download` | `docker run -it -v ".:/download" ghcr.io/jim60105/yt-dlp:pot URL` |
| Apify CLI / Crawlee | `./storage` in the project directory (default dataset at `storage/datasets/default/*.json`) | `apify run` (auto-mount under the hood) |

**Path conventions observed in the wild:** `/data` (pandoc, ffmpeg variants), `/output` (custom tools), `/workspace` (devcontainers), `/app/output` (when WORKDIR is `/app`), `/download` (yt-dlp), and tool-specific names. There is **no IETF-style standard**; the only universal practice is to (a) pick one short top-level path, (b) document it prominently, and (c) make it the container's `WORKDIR` so users can write relative paths.

#### 2.2.1 The Linux UID/GID problem

By default, processes inside a container run as `root` (UID 0). When the container writes to a bind-mounted host directory, those files end up owned by `root` on the host, which is annoying-to-actively-broken: the user's IDE/shell can't modify the files, `git` complains, `rm -rf output` requires sudo. macOS and Windows users mostly don't see this because Docker Desktop's file-sharing layer remaps ownership, but Linux users do.

The four established mitigations:

| Approach | How it works | Trade-off |
|---|---|---|
| **`--user "$(id -u):$(id -g)"`** at run time | Docker starts the container's PID 1 as that UID. New files inherit it. | Simple, no image changes needed. But the UID may not exist in `/etc/passwd` inside the container, breaking tools that read `$HOME` or expect a username. |
| **Static non-root user in the image** (`USER node`, `USER 1000`) | Files written are owned by 1000:1000. | Works on hosts where the user is also UID 1000 (the default for a single-user Linux desktop) but breaks for shared servers / CI runners with different UIDs. |
| **`fixuid` entrypoint shim** | Go binary with setuid bit; at startup it edits `/etc/passwd` and `chown`s a configured directory to match the UID that Docker was invoked with. | Cleanest DX (`docker run -u 1001:1001 …` "just works"), but adds setuid binary to the image; **not recommended for production images** by its own author. |
| **`gosu` / `su-exec` in entrypoint** | Entrypoint runs as root, fixes permissions on the mounted dir, then drops privileges. | Slightly more code in entrypoint; very common in linuxserver.io images. |

The simplest, most idiomatic approach for a CLI tool is the **pandoc pattern**: build the image as root, document `--user "$(id -u):$(id -g)"` in the README, and provide a shell alias snippet. This is what pandoc, aws-cli, and most of the extraction tools do.

#### 2.2.2 Cross-platform path syntax

The `$(pwd)` idiom is a `sh`/`bash` thing. The canonical README documents three forms:

| Shell | Current-directory expression |
|---|---|
| Linux/macOS bash, zsh | `$(pwd)` or `"$PWD"` |
| Windows PowerShell | `${PWD}` |
| Windows `cmd.exe` | `%cd%` |
| Cross-shell fallback | absolute path like `C:\Users\me\out` |

The aws-cli docs are a good template — they show all three forms side-by-side.

#### 2.2.3 Performance on macOS / Windows

This matters because contextractor batches can be MBs of output across thousands of files.

- On Linux, bind mounts are **zero-cost** (they're literally a Linux kernel mount).
- On Docker Desktop for Mac the daemon runs in a LinuxKit VM, so every read/write crosses a host↔VM boundary. With **gRPC FUSE** (the older default) bind mounts have historically been 5–10× slower than native; **VirtioFS** (default since Docker Desktop 4.6 on Apple Silicon) reduces this to roughly 3× slower. OrbStack and Colima with the `vz`/`virtiofs` backend are typically faster again. There is also a documented bug where files larger than ~2 GB on a VirtioFS bind mount can be truncated/seek-broken — relevant if a user pipes giant HTML backups.
- On Windows, paths bind-mounted from the Windows host (rather than from the WSL2 distro) go through 9P/VirtioFS over Hyper-V and are similarly slow.

**Practical guidance for contextractor:** for typical extraction output (KB to a few MB per URL), this is irrelevant. For batches that fetch and persist tens of thousands of raw HTML backups, document that users on macOS/Windows may want to use a **named volume** for the `--backup-dir` and only bind-mount the (much smaller) extracted JSON output.

### 2.3 Named Docker volumes

```bash
docker volume create ctx_output
docker run --rm -v ctx_output:/output contextractor https://example.com
docker run --rm -v ctx_output:/output alpine ls /output
```

Pros:

- Zero permission pain (owned by root inside the volume, but `chown` is irrelevant since users access it through containers).
- Native Linux performance even on Docker Desktop.
- Same syntax on every OS.
- Easy `docker volume cp` / `docker run --rm -v vol:/v alpine tar c /v` for export.

Cons:

- **Discoverability is poor.** End users don't know files are at `/var/lib/docker/volumes/ctx_output/_data` (and on Docker Desktop they're inside a VM, not directly accessible). For a CLI like `contextractor` whose purpose is "give me the article so I can read it / pipe it / commit it", named volumes are *worse* DX than bind mounts.
- Awkward to share with non-Docker tooling (an editor, `cat`, `jq`).

**Verdict:** Document named volumes only as an advanced option for users hitting macOS/Windows performance issues on large batches.

### 2.4 Streaming to stdout

This is what `hadolint`, `jq`, and (the simplest invocations of) `pandoc`, `ffmpeg`, and `trafilatura` itself do. The idiom:

```bash
# hadolint: input via stdin, results to stdout
docker run --rm -i hadolint/hadolint < Dockerfile

# ffmpeg: stream to GIF on stdout
docker run jrottenberg/ffmpeg -i http://… -f gif - > out.gif

# trafilatura on the host (no docker): outputs to stdout by default when no -o
trafilatura -u "https://example.com" > article.txt
```

**Pros:**

- Zero permission, path, or volume issues. Works identically on every OS.
- Composes naturally with Unix pipes: `docker run … contextractor URL | jq '.title'`.
- Plays well with CI: `docker run … > artifact.json && upload artifact.json`.
- No `docker volume prune` cleanup needed.

**Cons:**

- Only works for a single document per run (or a single concatenated stream like NDJSON).
- Mixing logs and data is a footgun. The convention is **logs/progress to stderr, structured data to stdout**. Docker's own daemon does this; so do hadolint, jq, ffmpeg-when-streaming, and aws-cli. Setting an `ENTRYPOINT` to a Python script that writes only the result to stdout (everything else through `logging` to stderr) makes this easy.
- Binary multi-file output (raw HTML + screenshots + JSON for many URLs) doesn't fit the stdout model unless you tar/zip the whole thing: `docker run … contextractor batch URLS | tar -xf -`. Some tools (e.g. `gh repo archive`) actually do this.
- TTY allocation: `docker run -it` injects ANSI colour codes and prompt characters into stdout. The convention is `docker run -i` (or no `-it` at all) when piping. AWS's docs explicitly call this out: "If you are trying to pipe output, `-it` might cause errors."

### 2.5 Hybrid approaches

These compose the above:

1. **Default-stdout, optional `-o`.** The cleanest CLI pattern, used by pandoc (`-o file` or stdout), trafilatura (no `-o` → stdout; `-o dir/` → directory), and pretty much every Unix tool.
2. **Tar-to-stdout for multi-file output.** `contextractor batch urls.txt --tar > batch.tar` when no `-o` is given. Avoids the "I need a volume just to get my files out" problem.
3. **Cloud destinations.** Adding `--output s3://bucket/prefix/` lets users skip volumes entirely on a server: the container reads URLs, writes JSON straight to S3 via the AWS SDK, exits. Useful for serverless / Fargate / cron-on-VPS use cases. Apify's actors do this implicitly via their key-value store and dataset abstractions.

---

## 3. What real-world tools do — a survey

| Tool | Default output destination | Mount path convention | Notable detail |
|---|---|---|---|
| **pandoc/core** | stdout (or `-o file`) | `/data` (WORKDIR) | Recommends `-u $(id -u):$(id -g)` in official docs; ships `pandock` alias snippet |
| **jrottenberg/ffmpeg** | stdout if last arg is `-`, otherwise file | `$(pwd):$(pwd) -w $(pwd)` mirror, or `/data` | Often shown with `-w $(pwd)` so paths in commands match host paths |
| **hadolint/hadolint** | stdout | none (reads stdin) | Pure stdin→stdout, the gold standard for "lightweight Dockerized CLI" |
| **jq** Docker images | stdout | none | Same pattern as hadolint |
| **capsulecode/singlefile** | stdout (default) or filename arg | `/usr/src/app/out` | Cross-platform examples in README: `$(pwd)` for unix, `%cd%` for Windows |
| **jim60105/yt-dlp** | files in CWD | `/download` (WORKDIR) | `docker run -it -v ".:/download" …` — mirrors local CWD pattern |
| **tnk4on/yt-dlp** | files | user-defined | Runs as non-root `yt-dlp` user inside the image |
| **amazon/aws-cli** | depends on subcommand | `/aws` (WORKDIR) + `/root/.aws` for creds | Documents `alias aws='docker run --rm -ti -v ~/.aws:/root/.aws -v $(pwd):/aws amazon/aws-cli'`; ECR-public over Docker Hub for rate limiting |
| **Apify CLI (`apify run`)** | local `./storage/{datasets,key_value_stores,request_queues}/default/*` | not Docker-bound by default | Two storage abstractions: dataset (tabular results) + key-value store (binary blobs like screenshots, INPUT.json) |
| **Crawlee** | `./storage/datasets/default/*.json` (default dataset) | configurable via `Configuration({ storageDir })` | Same dataset/KVS model as Apify; designed to be drop-in for cloud or local |
| **Playwright Docker (`mcr.microsoft.com/playwright`)** | nothing by default — user mounts test-results dir | user-defined | Recommends `--ipc=host`, `--init`, and a non-root `pwuser` for untrusted sites |
| **trafilatura (Python)** | stdout if no `-o`; one file per URL under `OUTPUTDIR` if `-o` set | n/a (not officially Dockerized) | Filename = hash of URL by default; `--keep-dirs` mirrors source URL path |
| **go-trafilatura** | stdout | n/a | `batch` subcommand reads list file, writes per-URL files |
| **newman (Postman)** | stdout summary; `--reporters cli,json --reporter-json-export /etc/newman/report.json` for files | `/etc/newman` | Bind-mount collections in, reports out |

The pattern is overwhelmingly consistent: **stdout for "give me the answer", a single bind-mount path for "give me a directory of outputs", and document `--user` for Linux UID safety.**

---

## 4. Specific considerations for web-scraping output

Scraping output is awkward because volume varies by orders of magnitude depending on whether the user is doing one URL or fifty thousand.

**Single URL invocation.** Output should go to stdout by default, with logs to stderr. No mount required. This is the case where most users start, and forcing them to learn `-v` for one article is bad DX.

**Batch invocation (URL list, sitemap, RSS feed, crawl).** Output should go to a directory. Sensible filename strategies, in order of preference:

1. **Hash of URL + format suffix** (trafilatura's default, `83a4…ff.json`). Stable, deduplicating, no path conflicts. Hard to read.
2. **Sequential** (`000001.json`, `000002.json`) — what Apify/Crawlee do for datasets. Easy to read, breaks if you re-run partial batches.
3. **Slugified URL/title** (`example-com_2024-05-12_some-article.json`). Human-friendly. Risk of collisions and filesystem-illegal characters; mitigations are non-obvious.
4. **`--keep-dirs`** (trafilatura's mode that mirrors `https://example.com/blog/post/` to `output/example.com/blog/post.json`). Best when you want filesystem navigation by domain.

**Always emit a `manifest.json`** (or `dataset_metadata.json` à la Apify) listing source URL → output path → status → timestamp → content-hash. This is the index that downstream pipelines read. Crawlee writes a similar `__metadata__.json` per dataset.

**Per-domain folders** are a useful default for crawls: `output/{domain}/{hash}.json`. Avoids the "one folder with 50 000 files" problem that murders `ls`, completion, and many filesystems.

**Per-run folders** (timestamped: `output/2026-05-07T14-22-00/…`) make repeat runs non-destructive and let users diff runs. trafilatura's `--keep-dirs` and Apify's run IDs both encode this idea.

**Streaming-to-stdout for batches.** A useful third option is **NDJSON** (`{...}\n{...}\n…`) on stdout — one extracted document per line. It composes with `jq -c`, `head`, `grep`, and `split`, and avoids the volume entirely. Many modern data CLIs (Singer taps, miller, jc) default to this.

---

## 5. Security considerations

- **Never tell users to `-v $HOME:/host` or `-v /:/host`.** It defeats container isolation and allows a vulnerable scraper or a malicious URL response to read SSH keys, browser profiles, etc. Always recommend a dedicated, narrow path like `$(pwd)/output:/output`.
- **Run as non-root inside the image.** Use a `USER` directive with a fixed UID/GID (1000 is conventional). Crawling content from arbitrary websites is exactly the situation where defence-in-depth matters; Playwright's docs explicitly warn that running browsers as root in Docker disables Chromium's sandbox and recommend a non-root `pwuser` plus a `seccomp` profile for untrusted browsing.
- **Read-only root filesystem.** A scraping CLI rarely needs to write outside `/output` and `/tmp`. Adding `--read-only --tmpfs /tmp` to the documented invocation is a meaningful hardening step.
- **Logs vs data.** If the tool writes logs to a file by default (e.g. `crawler.log`), make sure that file lives in `/output` (so it persists with results) or `/tmp` (read-only-fs friendly), **never** in `/var/log` or `/app` of the writable layer where users will lose it on `--rm`.
- **Network access.** Scraping needs the network, but it does **not** need `--network host` and almost never needs ports published (`-p`). Document the minimal permissions needed and skip both.
- **Resource limits.** A bad URL list or a server returning a 1 GB HTML page can OOM the host. Recommend `--memory 1g --cpus 2` in the example commands so users learn this idiom early.

---

## 6. DX/UX considerations for the CLI

### 6.1 Sensible defaults

The single most important UX rule for a Dockerized CLI is: **the trivial command should produce a useful result without flags.** That means:

```bash
docker run --rm contextractor https://example.com
```

…must print the extracted Markdown (or JSON) to stdout and exit with code 0. No `-v` required, no `-it`, no `-o`. Hadolint and pandoc both nail this; many home-grown tools fail it because they hard-require an output dir.

### 6.2 README usage block — recommended template

```markdown
## Quick start

# 1. Single URL → Markdown on stdout
docker run --rm ghcr.io/<org>/contextractor https://example.com

# 2. Single URL → JSON, piped to jq
docker run --rm ghcr.io/<org>/contextractor --json https://example.com | jq .title

# 3. Batch of URLs → directory of JSON files on the host
mkdir -p output
docker run --rm \
  -v "$(pwd)/output:/output" \
  -u "$(id -u):$(id -g)" \
  ghcr.io/<org>/contextractor \
  -i /output/urls.txt -o /output --json
```

### 6.3 Wrapper script vs raw `docker run` vs Compose

| Distribution form | When it's right |
|---|---|
| Raw `docker run` in README | Mandatory baseline. Don't hide this. |
| Shell alias snippet | High-value "if you use this often" |
| Wrapper script (`bin/contextractor` that `exec`s docker run) | Useful when there are 4+ flags users always want; ship it as part of `homebrew install contextractor` / npm postinstall |
| `docker-compose.yml` | Best when running as a long-lived service or when you need named volumes + env files + multiple services. For one-shot CLI invocations, Compose is overkill. |

Because contextractor already has an **npm-distributed CLI** (the host-side wrapper around `go-trafilatura`), the most consistent UX is to keep that CLI's flag surface (`--output-dir`, `--json`, `--config`, etc.) **identical** between the npm and Docker distributions. The Docker image is then "the same CLI, in a box".

---

## 7. Recommended implementation for `contextractor`

### 7.1 Dockerfile sketch

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-slim AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
# If you bundle a go-trafilatura binary or other native deps, COPY them here.

FROM node:22-slim
LABEL org.opencontainers.image.source="https://github.com/<org>/contextractor"
LABEL org.opencontainers.image.description="Web content extraction CLI (Trafilatura-powered)"

# Non-root user matching the conventional UID 1000.
RUN groupadd -g 1000 ctx && useradd -m -u 1000 -g ctx ctx

# Canonical output mount point. WORKDIR == /output so that users can pass
# relative paths (e.g. urls.txt) and have them resolve where they expect.
RUN mkdir -p /output && chown ctx:ctx /output
WORKDIR /output

COPY --from=build --chown=ctx:ctx /build /opt/contextractor
RUN ln -s /opt/contextractor/bin/contextractor.js /usr/local/bin/contextractor

USER ctx

# stdout = data, stderr = logs (enforced inside the JS entrypoint via console.error / pino).
ENTRYPOINT ["contextractor"]
CMD ["--help"]
```

Key choices:

- **Non-root by default.** UID 1000 matches the typical single-user Linux default and what most popular images use.
- **WORKDIR `/output`.** Users can pass `-i urls.txt` after `-v "$(pwd):/output"` and it Just Works.
- **`ENTRYPOINT` is the binary, `CMD` is `--help`.** So `docker run --rm contextractor` prints help, and `docker run --rm contextractor https://x` runs extraction. This is the same pattern as pandoc, jq, hadolint, and yt-dlp.
- **No persistent data baked into the image** — image stays small, ephemeral output stays ephemeral.

### 7.2 CLI behaviour rules

1. **No `-o` and exactly one URL** → write the document to **stdout**, logs/progress to stderr, exit 0.
2. **No `-o` and multiple URLs / `-i list.txt`** → write **NDJSON** to stdout (one JSON document per line). This composes with `jq`, `split`, `xargs`, etc.
3. **`-o /some/dir`** → write per-URL files (named `<sha1(url)>.{json,md,html}`) plus `manifest.json` indexing them. Mirror trafilatura's `-o OUTPUTDIR` behaviour.
4. **`--backup-dir /some/other/dir`** → optional raw HTML backups (matches trafilatura).
5. **`--screenshots`** (Playwright mode) → screenshots written under `<outdir>/screenshots/<sha1>.png`, referenced by path in `manifest.json`.
6. **All log output goes to stderr.** Use `pino` / `console.error`, never `console.log` for non-data lines.
7. **Exit codes**: 0 on full success, 2 on partial (some URLs failed but a manifest exists), 1 on hard error.

### 7.3 Sample invocations

```bash
# Trivial: one URL, Markdown on stdout
docker run --rm ghcr.io/<org>/contextractor https://example.com/article

# JSON pipeline
docker run --rm ghcr.io/<org>/contextractor --json https://example.com | jq .title > title.txt

# Batch, persist to host, run as host user (Linux)
mkdir -p out && cp urls.txt out/
docker run --rm \
  -v "$(pwd)/out:/output" \
  -u "$(id -u):$(id -g)" \
  ghcr.io/<org>/contextractor \
  -i urls.txt -o /output --json --backup-dir /output/raw

# Batch, NDJSON to stdout, no volume needed
docker run --rm -i ghcr.io/<org>/contextractor \
  -i - --ndjson < urls.txt > extractions.ndjson

# Hardened: read-only FS, memory cap, no host filesystem access except /output
docker run --rm --read-only --tmpfs /tmp \
  --memory 1g --cpus 2 \
  --network bridge \
  -v "$(pwd)/out:/output" \
  -u "$(id -u):$(id -g)" \
  ghcr.io/<org>/contextractor -i urls.txt -o /output

# macOS user with a large batch — use a named volume for raw HTML backups
docker volume create ctx_raw
docker run --rm \
  -v "$(pwd)/out:/output" \
  -v ctx_raw:/output/raw \
  -u "$(id -u):$(id -g)" \
  ghcr.io/<org>/contextractor -i urls.txt -o /output --backup-dir /output/raw
```

### 7.4 docker-compose.yml example for power users

```yaml
services:
  contextractor:
    image: ghcr.io/<org>/contextractor:latest
    user: "1000:1000"
    read_only: true
    tmpfs:
      - /tmp
    volumes:
      - ./out:/output
      - ./urls.txt:/output/urls.txt:ro
    command: ["-i", "urls.txt", "-o", "/output", "--json"]
    deploy:
      resources:
        limits:
          memory: 1g
          cpus: "2"
```

---

## 8. Pitfalls and gotchas specific to Dockerized scraping tools

1. **TTY contamination of stdout.** `docker run -it` injects ANSI sequences and `\r`s into stdout, breaking pipelines. Document `-i` (no `-t`) for piping.
2. **`-v $(pwd)/x:/x` creates an empty directory if `x` doesn't exist.** This is documented behaviour but trips users up. Mitigation: in the README, always `mkdir -p output` before the run, or use the `--mount` form which errors out instead of silently creating.
3. **Single-file bind mount is treated as a directory if the source path doesn't exist on the host.** Pre-create `urls.txt` before mounting it.
4. **Filename illegal characters / length.** Slugifying `https://example.com/some/article?id=42#frag` to a filename will break on Windows-mounted volumes. Hashing is safer.
5. **Filesystem fanout.** A 50 000-URL crawl writing into one flat dir crushes Finder, Explorer, and many Linux tools. Default to `output/<first-2-chars-of-hash>/<hash>.json` (git-style) or per-domain folders.
6. **macOS / Windows VirtioFS quirks.** Files larger than ~2 GB on a VirtioFS bind mount have been reported truncated on Docker Desktop for Mac. Recommend named volumes for those.
7. **DNS / proxy.** Containers don't inherit the host's `http_proxy` env vars unless you pass them. Document `-e HTTP_PROXY -e HTTPS_PROXY -e NO_PROXY` for users behind corporate proxies.
8. **Dockerfile `VOLUME` directive.** Avoid declaring `VOLUME /output` in the Dockerfile. It causes Docker to create an anonymous volume on every run and silently leaks disk.
9. **`--rm` and the exit-code paradox.** Belt-and-braces: write the manifest incrementally (open append, fsync per entry) so a crash leaves a partial-but-valid manifest in the bind-mounted output dir.
10. **Image rate limits.** Recommend mirroring the image to GHCR or ECR Public.
11. **arm64 / x86_64.** Build a `linux/amd64,linux/arm64` multi-arch image with `docker buildx`.

---

## 9. TL;DR

- Default to **stdout** (data) + **stderr** (logs). The tool must work without any `-v` for the simple case.
- For batches, bind-mount **`/output`** and document `--user "$(id -u):$(id -g)"` for Linux UID safety.
- Use a **non-root `USER`** in the Dockerfile. Drop privileges; never expose ports you don't need.
- Provide an **NDJSON-to-stdout** mode for batch pipelines that don't want a volume.
- Write a **`manifest.json`** for batch runs and never assume single output files.
- Document **all three** path syntaxes (`$(pwd)`, `${PWD}`, `%cd%`).
- Avoid `VOLUME` in the Dockerfile; let users decide between bind mounts and named volumes.
- Build **multi-arch** (`amd64` + `arm64`) and publish to a registry that doesn't rate-limit anonymous pulls (GHCR or ECR Public alongside Docker Hub).
