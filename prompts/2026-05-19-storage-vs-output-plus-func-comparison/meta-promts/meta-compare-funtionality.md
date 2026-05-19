
look on those porojects source code input and output schemas


- look on `/Users/miroslavsekera/r/actor-scraper/packages/actor-scraper/playwright-scraper` `https://apify.com/apify/playwright-scraper` (note that this is not exaclty purpose like contextractor, but is opensource)
- look on `https://apify.com/apify/website-content-crawler`
- look on https://crawlee.dev/ https://github.com/apify/crawlee

compare it with contextractor

ressearch:
- is there anythink missing in contextractor?
- are the current features implemented correctly?
- does contextractor has any useless (or too  niche) features?

create a promt that will add missing features, remove useless features or fix existing. features. the promt must also test the implementation locally and on apify platgorm. the promt must also update all applicable SPEC.md and README.md files and other doc files, save the resulting prompt to `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-19-storage-vs-output-plus-func-comparison/compare-funtionality.md`


review and fix if required `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-19-storage-vs-output-plus-func-comparison/storage-vs-output.md` - make sure it is not contradicting integrated, autofix problems


create  '/Users/miroslavsekera/r/contextractor-ts/prompts/2026-05-19-storage-vs-output-plus-func-comparison/master.md' master prompt that will call both promts

make sure both promts will not be in conflict, contradicting.
make sure both promts will update all SPEC.md files, README.md files and documentation.