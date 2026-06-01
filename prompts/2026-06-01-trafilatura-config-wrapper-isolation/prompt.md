> **TLDR**: Audit the codebase to confirm `TrafilaturaConfig` appears only in the Trafilatura wrapper (`@contextractor/extraction` and its native addon); wherever it leaked into the input schema, CLI, or Zod schema, inline its members and remove the type.

Ensure this:
We need to make sure that types called `TrafilaturaConfig` are only in the Trafilatura wrapper. `TrafilaturaConfig` does not belong to input schema, CLI, Zod schema. Do a deep research, and if found where it should not be, unwrap the `TrafilaturaConfig` members, remove TrafilaturaConfig
