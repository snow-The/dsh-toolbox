# @snow-the/dsh-toolbox

One settings surface for the `@snow-the/*` tool plugins.

Memory, busyloop and session-handoff each ship their own settings forms; this plugin hosts them
in one place (`Settings -> Tool settings`) instead of three separate panels, and exposes the
read-only data endpoints those forms use. It renders no viewers and owns no state of its own.

## Install

```powershell
npx @deepseek-ai/dsh@<engine-version> --profile web
# then add the bundle that ships this plugin, or:
dsh plugin --profile web add file:C:\path\to\dsh-toolbox
```

## Boundary

- It does **not** read or write the other plugins' data files; each plugin answers its own endpoints.
- If a settings form is missing, the plugin owning it is not mounted — toolbox will not fake it.

## License

MIT
