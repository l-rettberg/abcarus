# Settings Export/Import (offline, portable)

ABCarus is intentionally offline: no cloud accounts and no network sync.
To make your setup portable (SciTE-style), use the built-in **Export Settings** / **Import Settings** commands.

## Files

Export creates:
- `abcarus.properties` — the complete portable settings file, including Global Header as an escaped JSON string.
- `user_settings.abc` — a legacy-compatible copy of the user header layer (if present).

Import reads:
- `abcarus.properties`
- and optionally the legacy `user_settings.abc` if it is in the same folder.

The properties file is now self-contained for portability: copying only
`abcarus.properties` is sufficient to transfer Global Header settings. Existing
exports that rely on a neighboring `user_settings.abc` remain supported.

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

Tip: the userData folder can be opened via **Help → Open Settings Folder**.
