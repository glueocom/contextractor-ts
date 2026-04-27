# Test DELETE_PYPI_PAGE

## TLDR

Verify the PyPi help page is gone, sitemap and help index no longer link to it, and `redirects.json` returns a 301 to `/help/npm`. Autofix any deviation.

## Inputs

- `../implementation/step-delete-pypi-page.md`
- `../purge-python-notes/tools-repo-python-inventory.md`

## Checks

- `find /Users/miroslavsekera/r/tools/apps/contextractor-site/content -path '*/help/pypi*'` returns zero results
- `grep -rnF '/help/pypi' /Users/miroslavsekera/r/tools/apps/contextractor-site/{content,app}/` returns zero results (excluding `dist-content/`)
- `grep -nF 'pypi' /Users/miroslavsekera/r/tools/apps/contextractor-site/{additional-sitemap.json,see-also-placement.json,external-services-placement.json,redirects.json}` returns matches **only** in `redirects.json` (the new redirect entry)
- `redirects.json` parses as JSON and contains a `/help/pypi` → `/help/npm` redirect with `permanent: true` (or status `301`)
- `pnpm -F contextractor-site build` from `/Users/miroslavsekera/r/tools/` succeeds
- The produced sitemap (`apps/contextractor-site/.next/server/app/sitemap.xml.body` after build) does not contain `/help/pypi`
- `apps/contextractor-site/content/automatic/help/help.md` no longer links to a PyPi page

## Autofix

- If the page directory survived, `rm -rf` it
- If `help.md` still links to PyPi, Edit-tool the link out
- If a sitemap or placement JSON still mentions PyPi, Edit-tool that entry out (preserve JSON validity)
- If the redirect is missing, add it to `redirects.json` matching the file's existing entry shape
- If the site build fails, fix the underlying error rather than reverting the deletion
- If a public-facing article (e.g. `trafilatura.md`) lost a footnote that referenced `pypi.org/project/trafilatura/`, that is **not** an autofix target — those footnotes are about third-party Python packages and stay; restore them with `git checkout` if accidentally removed

## Done when

All checks pass; `pnpm -F contextractor-site build` succeeds; `git diff` shows only the listed deletes and JSON edits.
