# ABCarus Profile, Export, and Import

ABCarus uses one JSON profile for application preferences and working UI state:

```text
abcarus-profile.json
```

It contains ordinary settings, recent files and folders, dialog preferences,
Library UI state, and window state. It does not contain tunes or Global Header ABC.

## Runtime location

- Installed builds: the Electron user-data folder.
- Windows single-file portable builds: beside the executable.
- Windows and Linux portable-folder builds: the extracted application folder.

If the profile is absent, ABCarus starts with defaults and creates it automatically.
The adjacent `abcarus-profile.json.bak` is the last automatic profile backup.

On the first upgraded launch, legacy `state.json` and any attached
`abcarus.properties` preferences are read once. ABCarus writes the unified
profile successfully before removing the obsolete state files. The external
legacy `.properties` file itself is left untouched as a user-owned backup.

## Export

**Export Profile** writes a standalone copy named `abcarus-profile.json` to the
chosen location. Export does not attach that copy to ABCarus and later changes do
not modify it.

If the optional Global Header exists, Export also writes this neighboring file:

```text
user_settings.abc
```

Keep both files for a complete profile plus Global Header backup.

## Import

**Import Profile** reads the selected profile once, applies it to the canonical
runtime profile, and then closes the source file. There is no synchronization or
external-file watcher after Import.

For backward compatibility, Import also accepts legacy `abcarus.properties`
files. Their `key=value` preferences are merged once into the current profile.
Legacy embedded `globalHeaderText` is migrated to `user_settings.abc`.

## Global Header

`user_settings.abc` remains separate because it contains ABC directives rather
than application state. `Settings -> Global Header` edits it directly and saves
changes automatically. Its exact path is shown below the editor.

**Help -> Open Settings Folder** opens the directory containing the active profile
and `user_settings.abc` location.
