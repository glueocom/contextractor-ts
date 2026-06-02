This is a mete prompt: 
 - fixes two repositories `contextractor-ts` and `tools`
 - this metapromt  must generate two promt files - `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-06-02-cli-defaults-consistency/prompt.md` and a promt at a subfolder of `/Users/miroslavsekera/r/tools/prompts` for the tools repo.


review CLI commands and documentation and also documentation and readme files: with default values that are not required like:
    - `  --save-destination <dest>            Where to save: key-value-store|dataset (repeatable)(default: ["key-value-store"])` - this is the default parameter and could be omitted. The problem is that in some places this param is still supplied, e.g. contextractor-site `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-06-02-cli-defaults-consistency/meta/contextractor-playground-generated-commands.png`. Fix this and check all the related READE.md files SPEC.md files examples `/Users/miroslavsekera/r/contextractor-ts/examples` etc. Such params (check for other optional params with defaule values, like --storage-dir) should not be subblied. 
    - `  --save <format>                      Output format: markdown, txt, json, html, original, all (repeatable) (default: ["markdown"])`  - same case like `--save-destination`
    
    


    - `  --dynamic-content-wait <seconds>     Seconds to wait for network idle after navigation (0 = disabled)` - consider renaming to `--wait-for-dynamic-content`, because there is another parameter `--wait-for-selector` so lets make it consistent

- do not put any fluff text to the code examples at "macOS / Linux — run.sh": `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-06-02-cli-defaults-consistency/meta/contextractor-playground-generated-commands.png` - do not put any calling of the list command. instead put there a command that exports data from the storage foe the user. also `npm install @contextractor/standalone
` seems wrong, the package name is contextractor. it is the documentation for end users, the NPM package is living at https://www.npmjs.com/package/contextractor

- consider renaming `--target-language` so something like "filter by langauage" etc. -do deepo ressearch what is inustry standard name.

- review every simgle param: is it meaningful name, is the name accorting to best practices industry standards, cosnsitent with Apify/crawlee ecosystem?

- missing this page `https://www.contextractor.com/help/npm/`, must restore (look on git history, it was deleted recently). Also split that page to two - one for NPM standalone and one for NPM lib.