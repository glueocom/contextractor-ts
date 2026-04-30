- look into those tests
`/Users/miroslavsekera/r/tools/.claude/commands/test` find out (do a deep web ressearch)  which tests suites are missing for this repo  and create the test in the same way at `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/test`. Make them to run autonomously for whole repo like they had those counterparts `/Users/miroslavsekera/r/tools/.claude/commands/autonomous`, but keep them in one file, do not create pairs. You can load skills from the other repo though.

- create unit tests for files in  `/Users/miroslavsekera/r/contextractor-ts/apps` and `/Users/miroslavsekera/r/contextractor-ts/packages`.

- merge those files in `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/test-later/apify-platform` plus `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/platform/deploy-and-test.md`  into one file and place the file as one command into `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/test/apify-platform.md`. The new command must not generate unit tests tests in a separate package (`/Users/miroslavsekera/r/contextractor-ts/tools/generated-unit-tests`) instead, it must update existing unit tests at `/Users/miroslavsekera/r/contextractor-ts/apps` and `/Users/miroslavsekera/r/contextractor-ts/packages`.

- convert  (`/Users/miroslavsekera/r/contextractor-ts/tools/generated-unit-tests`) andt merge into unit tests at `/Users/miroslavsekera/r/contextractor-ts/apps` and `/Users/miroslavsekera/r/contextractor-ts/packages`.

- instead of `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/local-tests/prompt.md` create a test that will run and autofix all unit tests in whole repo. Place the slash command into `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/test`.  (use the logic of `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/local-tests/prompt.md` then delete the `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/local-tests/prompt.md`)

move `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/sync` to `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/sync/`. make the docs sync to call the `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/docs/update-docs-version.md`

- make everything in `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/` to run autonomously. produce repots and prompts to a separate folder like the `/Users/miroslavsekera/r/tools/.claude/commands/autonomous` is doing. make all the commands run by `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/maintenance.md` 

- move `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/validate.md` into propar place at `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/autonomous-maintenance/` 

- delete the empoty folders left after moving files

- update docuentation accordi gly, update rules accordingly, update `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/meta/setup.md`

- investigate on the internet which skils and agents are required for all ot hose, and install them, reference them in the commands as required
