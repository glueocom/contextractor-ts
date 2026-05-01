## Q: How should the stub be applied to the .sh files?

**A: STUB_MODE env var (permanent patch)**

Patch `lib/claude.sh` and `lib/opencode.sh` with a `STUB_MODE` check inside each function. Production runs unchanged. Test with `STUB_MODE=1 bash run-all.sh`.

## Q: What should the stubs print when a command is skipped?

**A: Echo only**

Just print `[STUB] would run: <cmd>`. No output files written to `autonomous-task-output/`.
