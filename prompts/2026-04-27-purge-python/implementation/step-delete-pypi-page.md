# Step DELETE_PYPI_PAGE: Delete the PyPi help page and clean its plumbing

## TLDR

Delete `apps/contextractor-site/content/automatic/help/pypi/`, drop the page from the help index, the sitemap, and any see-also placement, then add a 301 redirect from `/help/pypi` to `/help/npm` in `redirects.json`.

## Skills

- `ts-pro` — JSON edits with strict schema (sitemap, redirects)

## Delete the page directory

```bash
rm -rf /Users/miroslavsekera/r/tools/apps/contextractor-site/content/automatic/help/pypi
```

`apps/contextractor-site/dist-content/automatic/help/pypi/` is build output — leave it alone, the next `pnpm -F contextractor-site build` regenerates the dist tree without the page.

## Unlink from the help index

`apps/contextractor-site/content/automatic/help/help.md` — search for `pypi` (case-insensitive) and remove the link list item or the table row that points at the deleted page. Preserve the surrounding markdown structure.

## Drop from sitemap

`apps/contextractor-site/additional-sitemap.json` — open the file, find any entry whose URL matches `/help/pypi` or whose `loc` ends with `/help/pypi/`, and delete that entry. JSON arrays must remain valid; remove the trailing comma if needed.

If the sitemap is generated dynamically (e.g. `app/sitemap.ts`), grep for `pypi` in `apps/contextractor-site/app/` and remove any hard-coded entry. The Next.js sitemap route is regenerated at build time and will exclude the deleted page automatically.

## Drop from see-also / external-services placement

`apps/contextractor-site/see-also-placement.json` and `apps/contextractor-site/external-services-placement.json` — grep for `pypi`, `/help/pypi`, or `Contextractor PyPI`, and remove matching entries.

## Add the 301 redirect

`apps/contextractor-site/redirects.json` — add an entry redirecting `/help/pypi` (and `/help/pypi/`) to `/help/npm` with status `301`. Match the file's existing entry shape; for example, if other entries use `{"source": "/old", "destination": "/new", "permanent": true}`, follow that shape.

If the redirect file is consumed by `next.config.ts`, no further wiring is needed — Next reads it at build time.

## Verify

- `find /Users/miroslavsekera/r/tools/apps/contextractor-site/content -path '*/help/pypi*'` returns no results
- `grep -ril '/help/pypi\|pypi/pypi.md' /Users/miroslavsekera/r/tools/apps/contextractor-site/{content,app,*.json}` returns no results (excluding `dist-content/` and `.next/`)
- `redirects.json` parses as JSON and contains a `/help/pypi` → `/help/npm` redirect with `permanent: true` (or status `301`)
- `pnpm -F contextractor-site build` succeeds in tools repo
- A `curl -I http://localhost:3000/help/pypi` against the local dev server returns `301` to `/help/npm` (skip if a quick smoke-test is impractical; the build success is the main gate)
- The produced sitemap (XML or `app/sitemap.xml.body`) does not contain `/help/pypi`
