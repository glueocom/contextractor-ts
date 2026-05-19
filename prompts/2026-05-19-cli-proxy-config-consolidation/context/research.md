# CLI Proxy Configuration Consolidation — Research for `contextractor`

## TL;DR

- **Drop `--proxy-tier` and `--proxy-tiers` from the CLI.** Keep one repeatable `--proxy <url>` flag for the 90% case (a flat list of proxies), and put tiered proxy configuration into the existing `-c, --config <path>` JSON file for the 10% case. Crawlee itself enforces that `proxyUrls` and `tieredProxyUrls` are mutually exclusive at the constructor level, so the CLI surface should mirror that XOR — not paper over it with three overlapping flags.
- **`--proxy <url>` and `--proxy-tier <tier>` are redundant** for the single-tier case (the `--proxy-tier` form just smuggles a comma-delimited array into a single flag), and **`--proxy-tiers <json>` is redundant with `-c, --config`** (inline JSON on a CLI is widely treated as an anti-pattern when a config file already exists). The cleanest minimal API for `contextractor` is **`--proxy` (repeatable) + `--proxy-rotation` + `-c, --config` + `--input-file`** — four flags total, with tier configuration living in the config file.
- **Honor `http_proxy`/`https_proxy`/`no_proxy` environment variables** as the lowest-precedence layer; that is what every comparable scraping/download CLI (`curl`, `wget`, `trafilatura`, `aria2c`) does, and what clig.dev recommends.

## Key findings

1. **Crawlee's `ProxyConfiguration` constructor enforces a strict XOR** between `proxyUrls`, `tieredProxyUrls`, and `newUrlFunction`. The literal source check on the `master` branch is:
   ```ts
   if ([proxyUrls, newUrlFunction, tieredProxyUrls].filter((x) => x).length > 1)
       this._throwCannotCombineCustomMethods();
   ```
   Any CLI surface that lets users pass both `--proxy` and `--proxy-tier`/`--proxy-tiers` in the same invocation exposes a runtime crash path inside Crawlee.
2. **`tieredProxyUrls` is typed `(string | null)[][]`** (`type UrlList = (string | null)[]; tieredProxyUrls?: UrlList[];`). A `null` entry disables the proxy for that tier — the canonical pattern for "try direct, escalate on block." This `null` capability was added by PR #2743, closing issue #2740 filed November 8, 2024 by GitHub user `strongpauly`: *"When using the tieredProxyUrls option in ProxyConfiguration I would like to be able to start without a proxy, then escalate to using one if and when a request fails."*
3. **No mainstream scraping/download CLI exposes tier annotations as a flag.** `curl`, `wget`, `wget2`, `httpie`, `aria2c`, `playwright`, `puppeteer`, `yt-dlp`, `gallery-dl`, `trafilatura`, and `monolith` all use a single `--proxy` flag (or env var) for the URL; rotation/tiering is delegated to middleware (Scrapy's `scrapy-rotating-proxies`), config files (`gallery-dl.conf`, `aria2.conf`), or commercial smart-proxy gateways. The single-flag pattern is the standard.
4. **clig.dev's configuration guidance directly applies.** Tiered proxy fallback is "stable within a project, for all users" configuration — clig.dev says explicitly: *"Use a command-specific, version-controlled file."* The same document warns that secrets (proxy URLs frequently contain `user:pass@`) should not be read from flags because they leak to `ps` output and shell history.
5. **The existing CLI surface lets users do things Crawlee will reject.** Today's four-flag design (`--proxy`, `--proxy-rotation`, `--proxy-tier`, `--proxy-tiers`) has three flags that all target the same underlying Crawlee field with implicit precedence. The cleaner mental model — and the one Crawlee's own API expresses — is "pick one mode: flat list OR tiered list."

## Details

### 1. Crawlee's own model: `ProxyConfiguration` internals

#### 1.1 Constructor signature and validation (verbatim source)

From `apify/crawlee` master, `packages/core/src/proxy_configuration.ts`:

```ts
constructor(options: ProxyConfigurationOptions = {}) {
    const { validateRequired, ...rest } = options as Dictionary;
    ow(
        rest,
        ow.object.exactShape({
            proxyUrls: ow.optional.array.nonEmpty.ofType(ow.any(ow.string.url, ow.null)),
            newUrlFunction: ow.optional.function,
            tieredProxyUrls: ow.optional.array.nonEmpty.ofType(
                ow.array.nonEmpty.ofType(ow.any(ow.string.url, ow.null)),
            ),
        }),
    );

    const { proxyUrls, newUrlFunction, tieredProxyUrls } = options;
    if ([proxyUrls, newUrlFunction, tieredProxyUrls].filter((x) => x).length > 1)
        this._throwCannotCombineCustomMethods();
    if (!proxyUrls && !newUrlFunction && validateRequired) this._throwNoOptionsProvided();

    this.proxyUrls = proxyUrls;
    this.newUrlFunction = newUrlFunction;
    this.tieredProxyUrls = tieredProxyUrls;
}
```

Established facts from the source:

- **Mutual exclusion is mandatory.** Setting any two of `proxyUrls`, `newUrlFunction`, `tieredProxyUrls` throws `_throwCannotCombineCustomMethods()`, with the error: `'Cannot combine custom proxies "options.proxyUrls" with custom generating function "options.newUrlFunction".'` (Caveat: the error string is misleading — it mentions only `proxyUrls` and `newUrlFunction` but the runtime check covers `tieredProxyUrls` too.)
- **TypeScript signature:** `protected tieredProxyUrls?: UrlList[];` where `type UrlList = (string | null)[];`. The internal `ProxyTierTracker` constructor uses the explicit form `constructor(tieredProxyUrls: (string | null)[][])`.
- **JSDoc on the option:** *"An array of custom proxy URLs to be rotated stratified in tiers. This is a more advanced version of `proxyUrls` that allows you to define a hierarchy of proxy URLs … Use `null` as a proxy URL to disable the proxy for the given tier."*
- **`tieredProxyUrls` requires a crawler instance.** Crawlee's docs state: *"Note that the tieredProxyUrls option requires ProxyConfiguration to be used from a crawler instance … Using this configuration through the newUrl calls will not yield the expected results."* Tiered mode is tightly coupled to the crawler's request lifecycle — it observes retries to escalate tiers — so it is not a drop-in replacement for `proxyUrls`.

Source: https://github.com/apify/crawlee/blob/master/packages/core/src/proxy_configuration.ts

#### 1.2 Behavioral implication

A flat list and a tiered list are **two distinct modes**, not two encodings of the same data:

- `--proxy a --proxy b` → `proxyUrls: ['a','b']` → simple round-robin.
- Tiered fallback → `tieredProxyUrls: [[…cheap…],[…expensive…]]` → richer behavior (retry observation, domain tracking, session pool).

The CLI should reflect that distinction.

#### 1.3 Tiered proxies history

- **Introduced in PR #2348** (`tieredProxyUrls for ProxyConfiguration`, commit `5408c7f`), released in **Crawlee v3.10.0**.
- **Refined by PR #2743** (`tieredProxyUrls accept null for switching the proxy off`, closes issue #2740), released in the v3.11.x cycle per the Crawlee JS changelog at `crawlee.dev/js/api/core/changelog`. This added the ability to put `null` in a tier to mean "no proxy."
- **Motivation** (from Crawlee's announcement blog *How Crawlee uses tiered proxies to avoid getting blocked*): *"It is hard for developers to decide which proxy to use while scraping data. We might get blocked if we use datacenter proxies for low-cost scraping, but residential proxies are sometimes too expensive for bigger projects. … To manage this, we recently introduced tiered proxies in Crawlee."*

Sources:
- https://crawlee.dev/blog/proxy-management-in-crawlee
- https://crawlee.dev/js/docs/guides/proxy-management#tiered-proxies
- https://github.com/apify/crawlee/issues/2740

#### 1.4 Idiomatic Crawlee usage

```ts
// Flat list (90% case)
const proxyConfiguration = new ProxyConfiguration({
  proxyUrls: ['http://user:pass@proxy-1.com', 'http://user:pass@proxy-2.com'],
});

// Tiered fallback (10% case)
const proxyConfiguration = new ProxyConfiguration({
  tieredProxyUrls: [
    [null],                                                   // tier 0: no proxy
    ['http://datacenter-1.com', 'http://datacenter-2.com'],   // tier 1: cheap
    ['http://residential-1.com', 'http://residential-2.com'], // tier 2: expensive
  ],
});
```

---

### 2. Competitive analysis

| Tool | Single proxy | Multi-proxy / rotation | Tiered / fallback | Config-file alternative |
|---|---|---|---|---|
| **curl** | `-x/--proxy URL` (one only) | Not built-in; shell loops or `proxychains` | None | `~/.curlrc` |
| **wget** | `--proxy=on/off` + env vars `http_proxy`, `https_proxy` | None | None | `~/.wgetrc` |
| **wget2** | `--http-proxy`, `--https-proxy` | None | None | `~/.wget2rc` |
| **httpie** | `--proxy=PROTOCOL:URL` (per-protocol, repeatable per protocol) | One per protocol | None | `~/.config/httpie/config.json` |
| **aria2c** | `--http-proxy=`, `--https-proxy=`, `--all-proxy=` | None natively | None | `aria2.conf` |
| **playwright (chromium)** | `--proxy-server=URL` + `--proxy-bypass` | None on CLI (per-context in API) | None | `playwright.config.ts` |
| **puppeteer / chromium** | `--proxy-server=URL` (one) | None | None | N/A |
| **scrapy** | Request-meta or `HttpProxyMiddleware` | `scrapy-rotating-proxies`: `ROTATING_PROXY_LIST` (list) or `ROTATING_PROXY_LIST_PATH` (file) | None natively; commercial Zyte Smart Proxy | `settings.py` |
| **trafilatura** | Env var `http_proxy` only — *no proxy CLI flag* (issue #330) | None | None | `settings.cfg` |
| **yt-dlp** | `--proxy URL` (one) | Not native; `--proxy-file` requested in issues #10718 and #11331 | None | `youtube-dl.conf` |
| **gallery-dl** | `--proxy URL` (one) | Config file `extractor.*.proxy` only | None | `gallery-dl.conf` |
| **monolith / single-file-cli** | No native proxy flags | N/A | N/A | N/A |
| **Apify SDK / Crawlee** | `proxyUrls: [url]` | `proxyUrls: [...]` — round-robin | `tieredProxyUrls: (string\|null)[][]` (since v3.10) — **mutually exclusive with `proxyUrls`** | Actor `INPUT.json` with `editor: "proxy"` |

**The dominant industry pattern is unambiguous: one `--proxy` flag, no built-in tiering on the CLI.** Tiered/fallback logic is universally delegated to middleware, a smart-proxy commercial gateway, or a config file.

---

### 3. CLI design principles applied (clig.dev and friends)

The Command Line Interface Guidelines (`clig.dev`) by **Aanand Prasad** (engineer at Squarespace, co-creator of Docker Compose), **Ben Firshman** (founder and CEO of Replicate, creator of Fig/Docker Compose), **Carl Tashian** (developer advocate at Smallstep, first engineer at Zipcar, co-founder of Trove), and **Eva Parish** (technical writer at Squarespace, O'Reilly contributor) — per the InfoQ December 2020 CLIG author Q&A — is the de-facto modern style guide.

#### 3.1 Relevant clig.dev guidance

- **Configuration hierarchy.** clig.dev splits configuration into three buckets:
  1. *Environment varying with run context* → environment variables / `.env`
  2. *Stable within a project, for all users* → "Use a command-specific, version-controlled file" (e.g. `Makefile`, `package.json`, `docker-compose.yml`)
  3. *User-global preferences* → XDG-spec dotfiles

  Tiered proxy fallback sits squarely in bucket 2.
- **Use standard names for flags.** *"If another commonly used command uses a flag name, it's best to follow that existing pattern."* `--proxy` is the de-facto industry standard. `--proxy-tier`/`--proxy-tiers` have no precedent in any mainstream CLI surveyed.
- **Subjective robustness.** *"You want your software to feel like it isn't going to fall apart."* Three overlapping flags that all configure the same Crawlee field — with subtle precedence rules and a Crawlee constructor that throws on misuse — actively reduce subjective robustness.
- **Secrets via files, not flags.** clig.dev: *"Do not read secrets directly from flags … the flag value will leak the secret into ps output and potentially shell history. … Consider accepting sensitive data only via files."* Authenticated proxy URLs commonly contain `user:password@`.

Source: https://clig.dev/

#### 3.2 Industry patterns on inline-JSON-vs-config-file

- **`kubectl`** prefers manifests (`-f file.yaml`) over imperative flags. Sebastien Goasguen, *"Imperative/Declarative and a Few `kubectl` tricks"* (Bitnami Perspectives, Medium, February 1, 2018), describes the imperative-flag style as leading to *"bloating of the CLI and complex CLI commands to create objects."*
- **Docker** moved multi-container configuration from long `docker run` flag lists to `docker-compose.yml`.
- **Terraform, Ansible, GitHub Actions** make a stronger statement: nested configuration *only* lives in declarative files; there is no inline-JSON flag.
- **AWS CLI / `gcloud`** accept inline JSON for some operations (`--cli-input-json`) but document this as an escape hatch, not the primary path.

The consistent lesson: **inline JSON-on-CLI is an acceptable escape hatch, never the primary way to express nested structured config when a file alternative exists.**

#### 3.3 Why "repeatable with comma-CSV" (`--proxy-tier "a,b"`) is the worst of three options

- It cannot represent URLs that contain commas (legal in some query strings).
- Encoding the `null`-tier (no-proxy tier) as an empty string is awkward and incongruent with Crawlee's actual `null` value.
- POSIX argument parsing does not generally treat CSV as a list; libraries hand back a single string. clig.dev's recommended pattern for lists is repeatable flags (curl `--header`, gallery-dl `--input-file`, gh CLI `--label`).
- "Indexed flags" (`--proxy-tier-0`, `--proxy-tier-1`) have essentially zero precedent and scale poorly past 2–3 tiers.
- "Tier-annotated repeatable" (`--proxy http://a:tier=0`) corrupts the URL grammar and has no precedent.

**There is no clean way to make tiered proxies look ergonomic on the command line.** Stop trying.

---

### 4. Option-by-option evaluation

#### Option A — Keep current 4-flag design

**Pros:** No breaking change.
**Cons:** Three flags configure the same Crawlee field with implicit precedence; the CLI allows combinations Crawlee rejects; `--proxy-tier "a,b"` invents a comma-CSV pattern with no industry precedent; `--proxy-tiers` invites quoting hell, especially on Windows / in CI YAML; duplicates `-c, --config`; violates clig.dev's "subjective robustness" and "consistency across programs."
**Verdict: reject.**

#### Option B — Single repeatable `--proxy` + tier annotation

**Pros:** One flag for the URL.
**Cons:** Zero industry precedent; order-dependent semantics are ambiguous; embedding `:tier=N` corrupts URL grammar; user still has to mentally construct the tiered structure on the CLI — the very ergonomic problem we're trying to eliminate.
**Verdict: reject.**

#### Option C — Repeatable `--proxy` + config-file for tiered (**recommended**)

**Pros:** Matches `yt-dlp`/`curl`/`httpie`/`gallery-dl`/`playwright`/`puppeteer`/`wget` and Crawlee's `proxyUrls`. Tiered config lives in JSON in `-c, --config` (already exists), which is the natural representation for `(string|null)[][]` and what Crawlee accepts internally. Mirrors Crawlee's runtime XOR — one mode at a time. Minimizes flag surface. Forwards-compatible: future Crawlee proxy modes live in the config file.
**Cons:** Breaking change for anyone using `--proxy-tier`/`--proxy-tiers`. Slightly less convenient for one-off tiered runs (mitigation: `-c -` to read JSON from stdin, plus an optional `--proxy-file` convenience flag).
**Verdict: adopt.**

#### Option D — Notable variants worth considering as add-ons

- **`--proxy-file <path>`** (one URL per line, like `scrapy-rotating-proxies`' `ROTATING_PROXY_LIST_PATH` and the yt-dlp #11331 feature request). Reasonable optional add-on; still only addresses the flat-list case.
- **Honor `http_proxy`/`https_proxy`/`no_proxy` env vars** by default as the lowest-precedence layer. This is how 99% of corporate users expect proxies to work and what every comparable tool does.

---

### 5. Concrete recommendation for `contextractor`

#### 5.1 Final flag surface (proxy-related)

```
--proxy <url>                  Proxy URL. Repeatable. Maps to Crawlee proxyUrls.
                               Mutually exclusive with proxyConfiguration in --config.
                               (Inherits http_proxy/https_proxy env vars if unset.)

--proxy-rotation <strategy>    recommended | per_request | until_failure
                               (Unchanged — orthogonal to URL list.)

-c, --config <path>            JSON config file. May contain a `proxy` object with
                               either { "urls": [...] } OR { "tieredUrls": [[...],
                               [...]] } — the canonical home for tiered fallback.
                               Use `-c -` to read JSON from stdin.

--input-file <file>            URL list to scrape (one per line). Unchanged.
```

**Removed:** `--proxy-tier`, `--proxy-tiers`.

#### 5.2 Example usages

Flat list (90% case):
```sh
contextractor --proxy http://user:pass@proxy-1.com \
              --proxy http://user:pass@proxy-2.com \
              --input-file urls.txt
```

Apify environment (Crawlee picks up `APIFY_PROXY_PASSWORD`):
```sh
contextractor --input-file urls.txt
```

Tiered fallback (10% case) — via config file:
```sh
contextractor -c contextractor.config.json --input-file urls.txt
```

```jsonc
// contextractor.config.json
{
  "proxy": {
    "tieredUrls": [
      [null],                                              // tier 0: no proxy
      ["http://dc-1.example", "http://dc-2.example"],      // tier 1: datacenter
      ["http://res-1.example", "http://res-2.example"]     // tier 2: residential
    ],
    "rotation": "recommended"
  },
  "concurrency": 5,
  "outputDir": "./out"
}
```

This shape maps 1:1 onto Crawlee:
```ts
new ProxyConfiguration({
  tieredProxyUrls: config.proxy.tieredUrls, // (string|null)[][]
});
```

One-off tiered run from stdin:
```sh
echo '{"proxy":{"tieredUrls":[[null],["http://dc.example"]]}}' \
  | contextractor -c - --input-file urls.txt
```

#### 5.3 Config-file JSON schema (proxy section)

```jsonc
{
  "$id": "contextractor.config.schema.json",
  "type": "object",
  "properties": {
    "proxy": {
      "type": "object",
      "description": "Maps directly onto Crawlee ProxyConfigurationOptions.",
      "oneOf": [
        {
          "title": "Flat list (Crawlee proxyUrls)",
          "required": ["urls"],
          "properties": {
            "urls": { "type": "array", "items": { "type": "string", "format": "uri" } },
            "rotation": { "enum": ["recommended", "per_request", "until_failure"] }
          },
          "additionalProperties": false
        },
        {
          "title": "Tiered fallback (Crawlee tieredProxyUrls)",
          "required": ["tieredUrls"],
          "properties": {
            "tieredUrls": {
              "type": "array",
              "items": {
                "type": "array",
                "items": { "type": ["string", "null"], "format": "uri" }
              }
            },
            "rotation": { "enum": ["recommended", "per_request", "until_failure"] }
          },
          "additionalProperties": false
        }
      ]
    }
  }
}
```

The `oneOf` mirrors Crawlee's runtime XOR — the schema rejects the same combinations Crawlee's constructor rejects, so the user gets the error *before* a crawler is constructed.

#### 5.4 Precedence (clig.dev-compliant)

`--proxy` CLI flag (highest) > `proxy` section in `-c, --config` file > `http_proxy`/`https_proxy` env vars (lowest, used only if no other proxy specified).

Document this precedence in `--help` and the README, per clig.dev issue #110: document precedence explicitly so env vars don't silently override an explicit `-c` path.

#### 5.5 Apify Actor input-schema alignment

For the Apify Actor build, the existing `editor: "proxy"` UI in `INPUT_SCHEMA.json` produces an object of the shape `{ useApifyProxy, apifyProxyGroups, proxyUrls }` — Crawlee accepts this directly via `Actor.createProxyConfiguration(input.proxyConfiguration)`. The CLI's `proxy` config-file shape is a superset (it adds `tieredUrls`) and should remain compatible: when running as an Actor, the input schema is the source of truth; when running locally, the config file is.

---

## Recommendations / Migration plan

**Stage 1 — Implement Option C (immediate)**
1. Add `proxy` object to the config-file JSON schema, accepting either `{ urls: string[] }` or `{ tieredUrls: (string|null)[][] }` via `oneOf`.
2. Wire the config-file `proxy` section into the existing `ProxyConfiguration` construction path.
3. Add `-c -` (read config from stdin) support if it isn't already there.
4. Honor `http_proxy`/`https_proxy`/`no_proxy` env vars as the lowest-precedence proxy source.
5. Add CLI-level validation: if `--proxy` is given AND `config.proxy.tieredUrls` is set, error out with a clear message before reaching Crawlee.

**Stage 2 — Deprecate (next minor release)**
6. Keep `--proxy-tier` and `--proxy-tiers` working but emit a deprecation warning to stderr on use:
   ```
   WARN: --proxy-tier and --proxy-tiers are deprecated and will be removed in
   contextractor v2.0. Move tiered proxy configuration into your --config file
   under the "proxy.tieredUrls" key. See <link to MIGRATION.md>.
   ```
7. Update README and `--help` to show the new pattern only.
8. Add a `MIGRATION.md` with the table below:

   | Before | After |
   |---|---|
   | `--proxy-tier "a,b"` | `--proxy a --proxy b` |
   | `--proxy-tier "a,b" --proxy-tier "c"` | `proxy.tieredUrls: [["a","b"],["c"]]` in `--config` |
   | `--proxy-tiers '[["a","b"],["c"]]'` | Same `proxy.tieredUrls` value in `--config` |
   | `--proxy-tier ""` (no-proxy tier) | Use `null`, e.g. `[[null],["a"]]` |

**Stage 3 — Remove (next major / v2.0)**
9. Delete `--proxy-tier` and `--proxy-tiers`. Argument parser exits with code 2 and prints the migration message on encountering them.

**Benchmarks that would change these recommendations:**
- If you discover meaningful adoption of `--proxy-tier`/`--proxy-tiers` in user scripts (e.g. > 10% of telemetry-reported runs), extend the deprecation window from one minor to two or three.
- If Crawlee changes its API to make `proxyUrls` and `tieredProxyUrls` composable (very unlikely given the explicit `_throwCannotCombineCustomMethods()` check), re-evaluate.
- If `contextractor` adds non-Crawlee execution paths (a direct `fetch` fallback, a different crawler), revisit the abstraction at that point.

**Do not** keep `--proxy-tier`/`--proxy-tiers` "just because they exist." The evidence — Crawlee's mutually-exclusive API, clig.dev guidance, the unanimous industry pattern of one `--proxy` flag, and the absence of any mainstream CLI exposing tier annotations as a flag — points decisively to removal.

---

## Caveats

- **The `tieredProxyUrls` `null` syntax was added late** (PR #2743 in the Crawlee v3.11.x cycle, after issue #2740 was filed November 8, 2024 by `strongpauly`). If `contextractor` pins to a Crawlee version older than v3.11, `null` tier elements will fail Crawlee's `ow` validation; pin the dependency accordingly and reflect that in your schema.
- **`tieredProxyUrls` requires a crawler instance.** Crawlee explicitly warns that calling `proxyConfiguration.newUrl()` directly with a tiered configuration "will not yield the expected results." `contextractor` already uses a Crawlee crawler internally, so this is a non-issue for production use, but worth a code comment.
- **Crawlee's error message is misleading.** `_throwCannotCombineCustomMethods()` mentions only `proxyUrls` and `newUrlFunction` — it does not name `tieredProxyUrls` even though the XOR check includes it. If a user manages to pass both `--proxy` and a tiered config, catch this in `contextractor`'s own argument validation and produce a clearer error than Crawlee's.
- **Authenticated proxy URLs contain secrets.** clig.dev recommends not accepting secrets via flags (they leak to `ps` and shell history). The config-file path is genuinely the safer option for credentialed proxies; nudge users toward it in the docs, and consider supporting `${ENV_VAR}` interpolation in the config file for password fields.
- **One legitimate use of inline JSON was non-interactive CI** where you really don't want to commit a config file. `-c -` (stdin) covers this cleanly without keeping `--proxy-tiers` as a dedicated flag.
- **Crawlee's `proxyUrls` itself accepts `(string | null)[]`** per the `ow` schema. The CLI's `--proxy` flag does not need to support `null` since "no proxy" is "don't pass `--proxy`."

---

## Primary sources

- Crawlee source: https://github.com/apify/crawlee/blob/master/packages/core/src/proxy_configuration.ts
- Crawlee proxy management guide: https://crawlee.dev/js/docs/guides/proxy-management
- Crawlee tiered proxies blog: https://crawlee.dev/blog/proxy-management-in-crawlee
- ProxyConfigurationOptions API: https://crawlee.dev/js/api/core/interface/ProxyConfigurationOptions
- Crawlee changelog: https://crawlee.dev/js/api/core/changelog
- Crawlee issue #2740 (null tier support): https://github.com/apify/crawlee/issues/2740
- Command Line Interface Guidelines: https://clig.dev/
- InfoQ clig.dev author Q&A: https://www.infoq.com/news/2020/12/cli-guidelines-qa/
- Apify input schema spec: https://docs.apify.com/platform/actors/development/actor-definition/input-schema/specification/v1
- Trafilatura downloads (env-var-only proxy): https://trafilatura.readthedocs.io/en/latest/downloads.html
- gallery-dl manpage: https://manpages.ubuntu.com/manpages/jammy/man1/gallery-dl.1.html
- gallery-dl config manpage: https://manpages.ubuntu.com/manpages/jammy/en/man5/gallery-dl.conf.5.html
- yt-dlp proxy guide: https://www.huntapi.com/blog/yt-dlp-proxy-guide
- scrapy-rotating-proxies: https://github.com/TeamHG-Memex/scrapy-rotating-proxies
- kubectl imperative/declarative discussion: https://medium.com/bitnami-perspectives/imperative-declarative-and-a-few-kubectl-tricks-9d6deabdde
