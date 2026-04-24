# opencode-model-usage

OpenCode TUI plugin for checking model or subscription usage.

## Supported Providers

- **OpenCode Go** — rolling, weekly, and monthly subscription usage
- **GitHub Copilot** — monthly premium request usage, allowance, and overage

## Commands

| Command | Description |
|---------|-------------|
| `/model-usage` | Show cached usage (or fetch if stale) |
| `/model-usage-refresh` | Force a live refresh |

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
          "authCookie": "{env:OPENCODE_GO_AUTH_COOKIE}",
          "refreshIntervalMinutes": 5
        },
        "githubCopilot": {
          "username": "your-github-login",
          "token": "{env:GITHUB_COPILOT_TOKEN}",
          "refreshIntervalMinutes": 5,
          "monthlyAllowance": 300
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
export GITHUB_COPILOT_MONTHLY_ALLOWANCE="300"  # 300 for Pro, 1500 for Pro+
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
    "monthlyAllowance": 300
  }
}
```

String values support `{env:VARIABLE_NAME}` placeholders.

## Security

Never commit tokens or cookies to the repository. Prefer environment variables or a user-level config file over `tui.json`, which stores values in plaintext.
