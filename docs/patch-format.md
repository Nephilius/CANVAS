# Zip Patch Format

Canvas Studio accepts `.zip` patch packages with this required layout:

```text
patch.zip
- manifest.json
- payload/
  - app.asar
```

## manifest.json

```json
{
  "appId": "canvas-studio",
  "version": "0.1.5",
  "minSupportedVersion": "0.1.0",
  "packageFormat": "zip-patch",
  "entry": "payload/app.asar"
}
```

## Install Behavior

- the patch zip is validated before install
- `payload/app.asar` is extracted into a staging directory
- a detached PowerShell helper waits for the app to quit
- the helper backs up the current `resources/app.asar`
- the helper replaces `resources/app.asar` with the staged one
- the helper relaunches the app

## Performance Notes

- patch zips are generated in a fast low-compression `stored` mode
- this makes the patch file larger on disk, but noticeably reduces local install time
- the installer favors quicker extraction and restart handoff over maximum zip compression

## Patch Output Layout

Generated patches are stored in version-scoped folders:

```text
release/
- patches/
  - 0.1.1/
    - canvas-studio-patch-0.1.1.zip
  - 0.1.5/
    - canvas-studio-patch-0.1.5.zip
```

## Limitations

- first production version patches `app.asar` only
- full rollback UI is not implemented yet, but backups are stored in user data
