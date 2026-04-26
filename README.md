# opencode-model-usage

OpenCode TUI plugin for checking model or subscription usage.

## Supported Providers

- **OpenCode Go** — rolling, weekly, and monthly subscription usage
- **GitHub Copilot** — monthly premium request usage, allowance, and overage

## Commands

| Command | Description |
|---------|-------------|
| `/model-usage` | Fetch and show current usage |

## Install

```bash
npm install
npm run build
```

Then add to your `tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "file:///absolute/path/to/opencode-model-usage/dist/tui.js",
      {
        "opencodeGo": {
          "workspaceId": "wrk_your_workspace_id",
          "authCookie": "{env:OPENCODE_GO_AUTH_COOKIE}"
        },
        "githubCopilot": {
          "username": "your-github-login",
          "token": "{env:GITHUB_COPILOT_TOKEN}",
          "plan": "pro"
        }
      }
    ]
  ]
}
```

## Configuration

Priority: `tui.json` → environment variables → config file.

### Environment Variables

```bash
export OPENCODE_GO_WORKSPACE_ID="wrk_your_workspace_id"
export OPENCODE_GO_AUTH_COOKIE="Fe26.2**your_auth_cookie"

export GITHUB_COPILOT_USERNAME="your-github-login"
export GITHUB_COPILOT_TOKEN="github_pat_your_token"
export GITHUB_COPILOT_PLAN="pro"  # "pro" or "pro+"
```

### Config File

Create `opencode-model-usage.json` at one of these locations:
- `~/.config/opencode/`
- `~/.opencode/`
- `<project>/.opencode/`

```json
{
  "opencodeGo": {
    "workspaceId": "wrk_your_workspace_id",
    "authCookie": "{env:OPENCODE_GO_AUTH_COOKIE}"
  },
  "githubCopilot": {
    "username": "your-github-login",
    "token": "{env:GITHUB_COPILOT_TOKEN}",
    "plan": "pro"
  }
}
```

String values support `{env:VARIABLE_NAME}` placeholders.
`githubCopilot.plan` only supports `"pro"` and `"pro+"`, matching GitHub Copilot's official plan display. It defaults to `"pro"` when omitted.

## Security

Never commit tokens or cookies to the repository. Prefer environment variables or a user-level config file over `tui.json`, which stores values in plaintext.
