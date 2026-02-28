# Scribe - OnlyOffice Plugin

Scribe is an AI writing assistant plugin for OnlyOffice, integrated into Cozy Drive. This is the Phase 1 POC, focused on validating the OnlyOffice plugin API: loading a plugin, detecting text selection, reading selected text, replacing text, and inserting text.

## Prerequisites

- **Docker** installed and running
- **Port 80** available (or modify the port mapping in the setup script)
- A web browser with DevTools (Chrome/Firefox recommended)

## Quick Start

1. From the **repository root**, run the setup script:

   ```bash
   ./scripts/oo-dev-setup.sh
   ```

2. Wait for the server to start (1-2 minutes on first run). The script will print the OO Document Server version.

3. Open **http://localhost/example/** in your browser.

4. Create a new document or open an existing one.

5. Open browser DevTools console (**F12** or **Cmd+Opt+I**).

6. Look for the `[Scribe] Plugin loaded` log message in the console.

If the plugin does not appear, see [Troubleshooting](#troubleshooting) below.

## Dev Iteration Cycle

The development workflow is edit-refresh-check:

1. **Edit** files in `plugins/onlyoffice-scribe/` on your host machine
2. **Hard refresh** the browser (**Ctrl+Shift+R** / **Cmd+Shift+R**)
3. **Check** the DevTools console for `[Scribe]` log messages

Changes are picked up immediately because the plugin directory is volume-mounted into the Docker container.

### Re-registering the Plugin

If the plugin stops appearing after a container restart, re-register it:

```bash
docker exec oo-dev bash -c '/usr/bin/documentserver-pluginsmanager.sh \
  --directory="/var/www/onlyoffice/documentserver/sdkjs-plugins" \
  --update="/var/www/onlyoffice/documentserver/sdkjs-plugins/plugin-list-default.json"'
```

### Alternative: installDeveloperPlugin

If the volume mount approach does not register the plugin, use the browser console method:

1. In a separate terminal, serve the plugin files locally:

   ```bash
   cd plugins/onlyoffice-scribe
   npx http-server -p 3500 --cors
   ```

2. In the browser, open DevTools and select the `frameEditor` context in the console scope dropdown.

3. Run:

   ```javascript
   Asc.editor.installDeveloperPlugin("http://localhost:3500/config.json")
   ```

4. The plugin will load. To reload after changes, do an "Empty Cache and Hard Reload" (right-click the browser refresh button).

## Plugin Structure

```
plugins/onlyoffice-scribe/
  config.json          # Plugin manifest (GUID, type, capabilities)
  index.html           # Entry point (loads OO Plugin SDK and code.js)
  scripts/
    code.js            # Plugin logic (init, event handlers)
  resources/
    light/
      icon.png         # Plugin icon for light theme (40x40)
    dark/
      icon.png         # Plugin icon for dark theme (40x40)
```

### config.json

The plugin manifest defines:
- **name/guid**: Unique plugin identity (`asc.{C36B0B33-0C65-4E88-9EE0-C1D6A40434EC}`)
- **type: "panelRight"**: Plugin renders a visible panel on the right side of the editor (POC test panel; will switch to `"background"` in Phase 2+)
- **initOnSelectionChanged: true**: The `init()` function is called on every text selection change
- **initDataType: "text"**: Selection data is passed as a text string to `init()`
- **EditorsSupport: ["word"]**: Plugin only loads in the word processor
- **events**: Context menu integration hooks (`onContextMenuShow`, `onContextMenuClick`)

### index.html

HTML entry point with two parts:
1. **Test panel UI**: Status indicator, selected text display, Read/Replace/Insert buttons, and a log output area
2. **Script loading**: OnlyOffice Plugin SDK (`plugins.js`) from the official CDN, then `scripts/code.js`

### scripts/code.js

Full POC plugin logic implementing:
- **Selection detection** (PLUG-02): `plugin.init(data)` receives selected text on every change
- **Read selected text** (PLUG-03): `GetSelectedText` via "Read Selection" button
- **Replace selected text** (PLUG-04): `PasteText` with mock-transformed text via "Replace with Mock" button
- **Insert after selection** (PLUG-05): `callCommand` + `InsertContent` via "Insert After" button
- **Mock transform** (MOCK-01): Prefixes lines with "$ ", adds "--- SCRIBE START/END ---" markers
- **Context menu**: "Scribe - AI Assistant" item appears on right-click when text is selected
- **Test panel wiring**: All buttons and status updates driven from code.js

## Docker Details

### Volume Mount

The setup script mounts the plugin folder from the host into the container:

```
Host:      plugins/onlyoffice-scribe/
Container: /var/www/onlyoffice/documentserver/sdkjs-plugins/scribe
```

**Important:** Only the Scribe subfolder is mounted, NOT the entire `sdkjs-plugins/` directory. Mounting the parent directory would hide all default plugins that ship with the OO Docker image (the Docker bind mount replaces the container directory contents entirely).

### File Ownership

The Docker volume mount may change ownership of files in `plugins/onlyoffice-scribe/` to the container's internal user. If you get permission errors editing files, fix with:

```bash
sudo chown -R $(whoami):$(whoami) plugins/onlyoffice-scribe/
```

### Docker Environment Variables

The setup script configures these env vars for local dev:

- `JWT_ENABLED=false` — Disables JWT authentication (not needed for local dev)
- `DS_EXAMPLE_ENABLE=true` — Enables the built-in example page at `/example/`
- `ALLOW_PRIVATE_IP_ADDRESS=true` — Disables SSRF protection that blocks localhost URLs (OO's document service needs to fetch documents from itself)

### Common Docker Commands

```bash
# Check the OO Document Server version
docker exec oo-dev dpkg -l onlyoffice-documentserver

# Restart the server
docker restart oo-dev

# View server logs
docker logs oo-dev

# Follow logs in real time
docker logs -f oo-dev

# Remove the container (to start fresh)
docker rm -f oo-dev

# Shell into the container
docker exec -it oo-dev bash
```

## OO Version

After running the setup script, record the Document Server version here.

**Version:** 9.3.0-138

The version must be >= 8.2.0 (minimum for context menu API). Ideally >= 8.2.1 (fix for `initOnSelectionChanged` infinite loop bug). Version 9.3.0 is well above both thresholds.

To check the version at any time:

```bash
docker exec oo-dev dpkg -l onlyoffice-documentserver
```

## Known Constraints / Pitfalls

### callCommand Isolation

The `callCommand` function runs in a completely separate JavaScript sandbox (the editor's internal engine), NOT the plugin's iframe context. Variables from the plugin scope are `undefined` inside `callCommand`.

- Only JSON-serializable data passes through `Asc.scope`
- No functions, prototypes, or circular references
- No async operations (fetch, setTimeout, Promises) inside `callCommand`
- Do all async work in the plugin context BEFORE calling `callCommand`

### initOnSelectionChanged Loop (OO < 8.2.1)

On OO versions before 8.2.1, combining `initOnSelectionChanged: true` with `executeMethod` or `callCommand` inside `init()` causes an infinite execution loop. The executeMethod/callCommand calls trigger internal selection change events, which re-trigger `init()`.

**Symptoms:** Plugin `init()` fires continuously, editor becomes unresponsive, CPU spikes.

**Fix:** Upgrade to OO >= 8.2.1 where this bug is fixed.

### postMessage Routing

The plugin iframe is nested inside the OO editor iframe. From inside the plugin:
- `window.parent` = OO editor iframe (NOT Cozy Drive)
- `window.top` = Cozy Drive host page

Use `window.top.postMessage()` to communicate with the Cozy Drive host app. Using `window.parent.postMessage()` sends the message to the OO editor, not Cozy Drive.

**Note:** `window.top` access may be restricted by same-origin policy or `X-Frame-Options`. This needs validation in the POC.

## Troubleshooting

### Plugin Not Appearing in the Editor

1. **Check the container is running:** `docker ps | grep oo-dev`
2. **Check the plugin files are mounted:** `docker exec oo-dev ls /var/www/onlyoffice/documentserver/sdkjs-plugins/scribe/`
3. **Re-register the plugin:** See [Re-registering the Plugin](#re-registering-the-plugin)
4. **Try installDeveloperPlugin:** See [Alternative: installDeveloperPlugin](#alternative-installdeveloperplugin)
5. **Check for config.json errors:** `docker exec oo-dev cat /var/www/onlyoffice/documentserver/sdkjs-plugins/scribe/config.json`

### Port 80 Already in Use

Edit `scripts/oo-dev-setup.sh` and change `-p 80:80` to `-p 8080:80` (or any available port). Then access the server at `http://localhost:8080`.

### Container Fails to Start

```bash
# Check Docker logs for errors
docker logs oo-dev

# Remove and recreate
docker rm -f oo-dev
./scripts/oo-dev-setup.sh
```

### No Console Output from Plugin

1. Make sure you are looking at the correct console context. In Chrome DevTools, check the console scope dropdown -- you may need to select the correct iframe context.
2. Try a hard refresh (**Ctrl+Shift+R**) to clear cached scripts.
3. Verify the plugin is loaded by checking the Plugins tab in the OO editor toolbar.

## Test Plan

### Prerequisites
- OO Document Server running (via `./scripts/oo-dev-setup.sh`)
- Browser with DevTools open (Console tab)
- A document with some text paragraphs open in the editor

### Test 1: Plugin Loads (ENV-01, PLUG-01)
- [ ] Open the editor at http://localhost/example/
- [ ] Check Plugins tab -- Scribe should appear with its icon
- [ ] Test panel visible on the right side of the editor
- [ ] Console shows "[Scribe] Plugin loaded, test panel ready"
- [ ] Status indicator shows "No selection" (gray dot)

### Test 2: Selection Detection (PLUG-02)
- [ ] Select some text in the document
- [ ] Console shows "[Scribe] Selection: ..."
- [ ] Test panel status dot turns green
- [ ] Status text changes to "Selection active"
- [ ] Selected text appears in the test panel's "Selected Text" area
- [ ] Deselect text (click without selecting) -- status returns to gray/"No selection"

### Test 3: Read Selected Text (PLUG-03)
- [ ] Select text in the document
- [ ] Click the "Read Selection" button in the test panel
- [ ] Console shows "[Scribe] GetSelectedText result: ..."
- [ ] Test panel displays the selected text (should match what is shown via init)
- [ ] Try with no selection -- log should show "(empty)"

### Test 4: Replace Selected Text (PLUG-04)
- [ ] Select a paragraph of text
- [ ] Click "Replace with Mock"
- [ ] Selected text is replaced with mock transform in the document:
  - Lines prefixed with "$ "
  - "--- SCRIBE START ---" at the beginning
  - "--- SCRIBE END ---" at the end
- [ ] Console shows "[Scribe] Replacing selection with mock transform..." and "[Scribe] PasteText called"
- [ ] Undo (Ctrl+Z) restores the original text
- [ ] With no selection, button should be disabled

### Test 5: Insert After Selection (PLUG-05)
- [ ] Select a paragraph of text
- [ ] Click "Insert After"
- [ ] New paragraph appears with mock-transformed text
- [ ] **Critical finding:** Does the new paragraph appear AFTER the selection (preserving original), or does it REPLACE the selection?
- [ ] Console shows "[Scribe] Inserting mock transform after selection..." and "[Scribe] callCommand dispatched for InsertContent"
- [ ] Undo (Ctrl+Z) removes the inserted text
- [ ] With no selection, button should be disabled

### Test 6: Formatted Document
- [ ] Open a document with bold, italic, bullet lists
- [ ] Select formatted text
- [ ] Test Read -- does it capture plain text correctly?
- [ ] Test Replace -- does it preserve surrounding formatting?
- [ ] Test Insert -- does the inserted text appear as a normal paragraph?

### Test 7: Context Menu (PLUG-02)
- [ ] Select text in the document
- [ ] Right-click to open context menu
- [ ] "Scribe - AI Assistant" menu item should appear
- [ ] Click it -- console should show "[Scribe] Context menu 'Scribe' clicked"
- [ ] Right-click without selection -- "Scribe" should NOT appear

### Test 8: Dev Iteration (ENV-03)
- [ ] Edit code.js (e.g., change a log message)
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Verify the change is reflected (new log message visible)
- [ ] Time from save to seeing the change: ___ seconds (target: < 10s)

### Test 9: Selection Persistence
- [ ] Select text in the document
- [ ] Click the "Read Selection" button in the test panel
- [ ] Does the selection persist in the editor after clicking the panel button?
- [ ] **Critical finding:** Does clicking in the test panel iframe cause selection loss?
- [ ] If selection is lost, does the cached `lastSelectedText` still allow Replace/Insert to work?

## API Findings

### Selection Detection (initOnSelectionChanged)
- **Reliability:** _To be determined during testing_
- **Loop issues:** Expected to be safe on OO 9.3.0 (bug fixed in 8.2.1)
- **Edge cases:** _To be determined -- empty selections, cursor-only, etc._

### GetSelectedText
- **Format returned:** _To be determined -- plain text, how paragraphs are separated_
- **Paragraph separator:** Expected to be "\n" (configured in options)
- **Formatted text handling:** _To be determined -- does it strip formatting?_

### PasteText
- **Selection replacement:** _To be determined -- does it reliably replace the selection?_
- **No selection behavior:** _To be determined -- does it insert at cursor?_
- **Selection loss workaround:** If selection is lost when clicking test panel, may need SearchAndReplace fallback

### InsertContent via callCommand
- **Insert vs Replace:** _Critical finding -- does InsertContent insert AFTER selection or replace it?_
- **Cursor positioning:** _To be determined -- where does the cursor end up after insert?_
- **Asc.scope serialization:** Expected to work for plain text strings

### Context Menu
- **Visibility:** _To be determined -- does "Scribe" appear reliably?_
- **Click handling:** _To be determined -- does attachContextMenuClickEvent work?_

## Known Issues

_Issues discovered during testing will be documented here._

### Pending Investigation
1. **InsertContent behavior:** Does `InsertContent` insert after or replace the selection? (Open Question 2 from Research)
2. **Selection persistence:** Does clicking in the test panel (same iframe) cause selection loss? (Pitfall 3 from Research)
3. **panelRight + initOnSelectionChanged:** Does `initOnSelectionChanged` work correctly with `type: "panelRight"`? (was originally designed for `type: "background"`)
