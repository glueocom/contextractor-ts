- look into those tests
`/Users/miroslavsekera/r/tools/.claude/commands/test` find out (do deep web research) which test suites are missing for this repo and create the tests in the same way at `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/test`. Make them run autonomously for the whole repo like their counterparts in `/Users/miroslavsekera/r/tools/.claude/commands/autonomous`, but keep them in one file; do not create pairs. You can copy skills from the other repo though.

- create unit tests for files in  `/Users/miroslavsekera/r/contextractor-ts/apps` and `/Users/miroslavsekera/r/contextractor-ts/packages`.

- merge those files in `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/test-later/apify-platform` plus `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/platform/deploy-and-test.md` into one file and place it as one command into `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/test/apify-platform.md`. The new command must not generate unit tests in a separate package (`/Users/miroslavsekera/r/contextractor-ts/tools/generated-unit-tests`); instead, it must update existing unit tests at `/Users/miroslavsekera/r/contextractor-ts/apps` and `/Users/miroslavsekera/r/contextractor-ts/packages`. (In other words, at a proper subfolder of `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/` create a slash command to run `/Users/miroslavsekera/r/contextractor-ts/tools/platform-test-runner`.) DRY, keep using `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/platform/deploy-and-test.md` if appropriate

- convert  (`/Users/miroslavsekera/r/contextractor-ts/tools/generated-unit-tests`) and merge into unit tests at `/Users/miroslavsekera/r/contextractor-ts/apps` and `/Users/miroslavsekera/r/contextractor-ts/packages`.

- instead of `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/local-tests/prompt.md` create a test that will run and autofix all unit tests in the whole repo. Place the slash command into `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/test`. (Use the logic of `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/local-tests/prompt.md`, then delete `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/local-tests/prompt.md`.)

- move `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/sync` to `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/sync/`. Make the docs sync reuse the logic in `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/docs/update-docs-version.md`

- make everything in `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/` run autonomously. Produce reports and prompts to a separate gitignored folder like `/Users/miroslavsekera/r/tools/.claude/commands/autonomous` does. Make all the commands be run by `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/maintenance.md`

- all slash commands (except `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/maintenance.md` ) must have subfolder under `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance`

- move `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/validate.md` into a proper subfolder under `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/`

- delete the empty folders left after moving files

- update documentation accordingly, update rules accordingly, update `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/meta/setup.md`

- at a proper subfolder of `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/` create a slash command to run `/Users/miroslavsekera/r/contextractor-ts/tools/gen-input-schema`


- at a proper subfolder of `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/` create a slash command to run `/Users/miroslavsekera/r/contextractor-ts/tools/gen-md-regions`
- at a proper subfolder of `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/` create a slash command to run `/Users/miroslavsekera/r/contextractor-ts/tools/opencode-sync`

- make sure `/Users/miroslavsekera/r/contextractor-ts/tools/opencode-sync` first purges target files - tha claude config is the master, opencode config nd setup s mirror of claude config.

- investigate on the internet which skills and agents are required for all of those, and create or copy them into this repo, reference them in the commands as required
