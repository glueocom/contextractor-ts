**Q:** Source has 4 commands the target lacks. Which to port to TS+Rust? (`publish/all.md` is multi-channel Apify+npm+PyPI+Docker but target is Apify-only; `sync/gui.md` / `sync/docs.md` enforce package/README consistency from Python source-of-truth; `git/release.md` is a tag-based version-bump keyed off `pyproject.toml`.)

**A:** Port three, skip `publish/all.md`.

- Port `commands/git/release.md` rewritten for Cargo + npm version bump.
- Port `commands/sync/docs.md` rewritten for **Rust AND TypeScript** source-of-truth (user note: "must not be only Rust, also typescript — do it for all similar cases, rust and typescript").
- Port `commands/sync/gui.md` rewritten as cross-package consistency check for **Rust AND TypeScript**.
- Skip `commands/publish/all.md`. Target only ships to Apify; `commands/platform/push-and-get-working.md` already covers that. Multi-channel publish does not apply.

The user's "all similar cases" directive applies to every port in this prompt: when an upstream Python file references a single language source-of-truth, the ported version must cover both Rust and TypeScript surfaces.
