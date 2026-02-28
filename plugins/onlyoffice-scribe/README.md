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

3. Open **http://localhost** in your browser.

4. Create a new document or upload a `.docx` file.

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
- **type: "background"**: Plugin runs silently without its own UI panel inside OO
- **initOnSelectionChanged: true**: The `init()` function is called on every text selection change
- **initDataType: "text"**: Selection data is passed as a text string to `init()`
- **EditorsSupport: ["word"]**: Plugin only loads in the word processor
- **events**: Context menu integration hooks

### index.html

Minimal HTML that loads two scripts in order:
1. The OnlyOffice Plugin SDK (`plugins.js`) from the official CDN
2. The plugin logic (`scripts/code.js`)

### scripts/code.js

Plugin logic. In the current minimal scaffold, it only logs when the plugin initializes and when text is selected.

## Docker Details

### Volume Mount

The setup script mounts the plugin folder from the host into the container:

```
Host:      plugins/onlyoffice-scribe/
Container: /var/www/onlyoffice/documentserver/sdkjs-plugins/scribe
```

**Important:** Only the Scribe subfolder is mounted, NOT the entire `sdkjs-plugins/` directory. Mounting the parent directory would hide all default plugins that ship with the OO Docker image (the Docker bind mount replaces the container directory contents entirely).

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

**Version:** ____

The version must be >= 8.2.0 (minimum for context menu API). Ideally >= 8.2.1 (fix for `initOnSelectionChanged` infinite loop bug).

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
