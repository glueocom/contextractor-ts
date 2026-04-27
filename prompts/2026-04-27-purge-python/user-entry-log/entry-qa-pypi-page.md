# Q&A — PyPi help page

## Question

What should happen to the PyPi help page at `/Users/miroslavsekera/r/tools/apps/contextractor-site/content/automatic/help/pypi/pypi.md`?

## Options offered

- Delete the page entirely (with 301 redirect to `/help/npm`)
- Rewrite as a deprecation notice
- Leave the page alone

## User answer

**Delete the page entirely.** Remove `pypi/pypi.md`, unlink it from `help.md` and any sitemap, and add a 301 redirect from `/help/pypi` to `/help/npm`.

## Implications for implementation

- `step-delete-pypi-page` covers the deletion, sitemap update, help-index update, and `redirects.json` entry
