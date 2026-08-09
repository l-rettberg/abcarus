# Settings Export/Import (offline, portable)

ABCarus is intentionally offline: no cloud accounts and no network sync.
To make your setup portable (SciTE-style), use the built-in **Export Settings** / **Import Settings** commands.

## Files

Export creates:
- `abcarus.properties` — application preferences in UTF-8 `key=value` format.
- `user_settings.abc` — the Global Header as ordinary ABC text, if that file exists.

Import reads:
- `abcarus.properties`
- and optionally `user_settings.abc` if it is in the same folder.

Keep both files when backing up or moving all settings. Global Header ABC is
never stored in new `abcarus.properties` exports. Older properties files that
embed `globalHeaderText` can still be imported once for migration.

## Global Header file

`Settings -> Global Header` edits `user_settings.abc` directly and saves changes
automatically. The exact path is shown below the editor.

- Installed builds use the Electron user-data folder.
- Windows single-file portable builds use the executable folder.
- Windows and Linux portable-folder builds use the extracted application folder.

If `user_settings.abc` does not exist, the Global Header layer is empty. ABCarus
creates it only after non-empty text is entered or an existing backup is imported.
Deleting the file intentionally leaves the layer empty; old state does not recreate it.

## Optional: attach a canonical settings file

By default, ABCarus keeps settings internally (under the OS profile).

When you **Export Settings…** (or **Import Settings…**), the selected `abcarus.properties` becomes the **canonical**
settings source of truth on the next start.

If you later edit the canonical file externally, ABCarus will pick it up on the next start and also when the app
regains focus (best-effort, without background watchers).

If the canonical file disappears, ABCarus falls back to the last internal snapshot and continues to work.

## Where settings live by default

ABCarus also keeps its live state under the OS user profile (`app.getPath('userData')`).
Uninstall behavior differs by OS/installer, so **Export Settings** is the reliable way to preserve your configuration.

Tip: **Help -> Open Settings Folder** opens the folder containing the active
`user_settings.abc` location. In installed builds this is the user-data folder;
in portable-folder builds this is the portable application folder.
