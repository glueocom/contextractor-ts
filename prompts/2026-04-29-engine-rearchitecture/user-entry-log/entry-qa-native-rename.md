**Q**: After renaming `packages/contextractor-engine` → `packages/extraction`, should the native binding package also be renamed from `@contextractor/engine-native` (and platform variants like `@contextractor/engine-native-darwin-arm64`) to `@contextractor/extraction-native-*`?

**A**: Rename native too.

Rename to `@contextractor/extraction-native-*`. Consistent naming; requires updating all `optionalDependencies` references and publishing new npm prebuilt packages under the new names.
