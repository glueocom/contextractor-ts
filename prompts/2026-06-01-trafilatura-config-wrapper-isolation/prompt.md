Ensure this:
We need to make sure that types called `TrafilaturaConfig` are only in the Trafilatura wrapper. `TrafilaturaConfig` does not belong to input schame, CLI, Zod schame. Do a deep ressearch, and if found where it should not be, unerap the `TrafilaturaConfig` members, remove TrafilaturaConfig
