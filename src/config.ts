import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const CONFIG_FILE = "opencode-model-usage.json"
const ENV_REFERENCE_PATTERN = /^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/
const ENV_PLACEHOLDER_PATTERN = /^\{env:(.+)\}$/

export type OpenCodeGoConfig = {
  workspaceId: string
  authCookie: string
}

export type GitHubCopilotPlan = "pro" | "pro+"

export type GitHubCopilotConfig = {
  username: string
  token: string
  plan: GitHubCopilotPlan
}

export type PluginConfigOverrides = Partial<{
  workspaceId: unknown
  authCookie: unknown
  opencodeGo: {
    workspaceId?: unknown
    authCookie?: unknown
  }
  githubCopilot: {
    username?: unknown
    token?: unknown
    plan?: unknown
  }
}>

export type OpenCodeGoConfigOverrides = PluginConfigOverrides
export type GitHubCopilotConfigOverrides = PluginConfigOverrides

type ConfigFile = {
  opencodeGo?: Partial<OpenCodeGoConfig>
  githubCopilot?: Partial<GitHubCopilotConfig>
  workspaceId?: string
  authCookie?: string
}

export function getConfigPaths(): string[] {
  const homeDirectory = os.homedir()

  return [
    path.join(homeDirectory, ".config", "opencode", CONFIG_FILE),
    path.join(homeDirectory, ".opencode", CONFIG_FILE),
    path.join(process.cwd(), ".opencode", CONFIG_FILE),
  ]
}

export function loadOpenCodeGoConfig(overrides?: OpenCodeGoConfigOverrides): OpenCodeGoConfig {
  const config = loadOptionalOpenCodeGoConfig(overrides)
  if (config) return config

  throw new Error(
    [
      "OpenCode Go is not configured.",
      "Set plugin options in tui.json,",
      "or OPENCODE_GO_WORKSPACE_ID and OPENCODE_GO_AUTH_COOKIE,",
      `or add them to ${CONFIG_FILE}.`,
    ].join(" "),
  )
}

export function loadOptionalOpenCodeGoConfig(overrides?: OpenCodeGoConfigOverrides): OpenCodeGoConfig | null {
  const fileConfig = readOpenCodeGoConfigFile()
  const optionConfig = readOpenCodeGoOverrides(overrides)
  const workspaceId = (optionConfig.workspaceId ?? process.env.OPENCODE_GO_WORKSPACE_ID ?? fileConfig.workspaceId)?.trim()
  const authCookie = (optionConfig.authCookie ?? process.env.OPENCODE_GO_AUTH_COOKIE ?? fileConfig.authCookie)?.trim()

  if (!workspaceId && !authCookie) return null

  const merged = {
    workspaceId,
    authCookie,
  }

  if (!merged.workspaceId || !merged.authCookie) {
    throw new Error(
      [
        "OpenCode Go is not configured.",
        "Set plugin options in tui.json,",
        "or OPENCODE_GO_WORKSPACE_ID and OPENCODE_GO_AUTH_COOKIE,",
        `or add them to ${CONFIG_FILE}.`,
      ].join(" "),
    )
  }

  if (!/^wrk_[A-Za-z0-9_-]+$/.test(merged.workspaceId)) {
    throw new Error("OPENCODE_GO_WORKSPACE_ID is invalid.")
  }

  if (merged.authCookie.length < 10) {
    throw new Error("OPENCODE_GO_AUTH_COOKIE looks invalid.")
  }

  return {
    workspaceId: merged.workspaceId,
    authCookie: merged.authCookie,
  }
}

export function loadGitHubCopilotConfig(overrides?: GitHubCopilotConfigOverrides): GitHubCopilotConfig {
  const config = loadOptionalGitHubCopilotConfig(overrides)
  if (config) return config

  throw new Error(
    [
      "GitHub Copilot is not configured.",
      "Set githubCopilot.username and githubCopilot.token in tui.json,",
      "or GITHUB_COPILOT_USERNAME and GITHUB_COPILOT_TOKEN,",
      `or add them to ${CONFIG_FILE}.`,
    ].join(" "),
  )
}

export function loadOptionalGitHubCopilotConfig(
  overrides?: GitHubCopilotConfigOverrides,
): GitHubCopilotConfig | null {
  const fileConfig = readGitHubCopilotConfigFile()
  const optionConfig = readGitHubCopilotOverrides(overrides)
  const username = (optionConfig.username ?? process.env.GITHUB_COPILOT_USERNAME ?? fileConfig.username)?.trim()
  const token = (optionConfig.token ?? process.env.GITHUB_COPILOT_TOKEN ?? fileConfig.token)?.trim()

  if (!username && !token) return null

  const merged = {
    username,
    token,
    plan: parsePlan(
      optionConfig.plan ?? process.env.GITHUB_COPILOT_PLAN ?? fileConfig.plan,
    ),
  }

  if (!merged.username || !merged.token) {
    throw new Error(
      [
        "GitHub Copilot is not configured.",
        "Set githubCopilot.username and githubCopilot.token in tui.json,",
        "or GITHUB_COPILOT_USERNAME and GITHUB_COPILOT_TOKEN,",
        `or add them to ${CONFIG_FILE}.`,
      ].join(" "),
    )
  }

  if (!/^[A-Za-z0-9-]+$/.test(merged.username)) {
    throw new Error("GITHUB_COPILOT_USERNAME is invalid.")
  }

  if (merged.token.length < 20) {
    throw new Error("GITHUB_COPILOT_TOKEN looks invalid.")
  }

  return {
    username: merged.username,
    token: merged.token,
    plan: merged.plan,
  }
}

function readConfigFile(): ConfigFile {
  let parseError: Error | null = null

  for (const filePath of getConfigPaths()) {
    if (!fs.existsSync(filePath)) continue

    try {
      const parsed = parseConfigFile(filePath)
      if (parsed) return parsed
    } catch (error) {
      parseError = error instanceof Error ? error : new Error(`Failed to read config file: ${filePath}`)
    }
  }

  if (parseError) throw parseError

  return {}
}

function parseConfigFile(filePath: string): ConfigFile {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ConfigFile
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse config file: ${filePath}`)
    }
    throw new Error(`Failed to read config file: ${filePath}`)
  }
}

function readOpenCodeGoConfigFile(): Partial<OpenCodeGoConfig> {
  const parsed = readConfigFile()
  const opencodeGo = parsed.opencodeGo ?? parsed

  return {
    workspaceId: asTrimmedString(opencodeGo.workspaceId),
    authCookie: asTrimmedString(opencodeGo.authCookie),
  }
}

function readGitHubCopilotConfigFile(): Partial<GitHubCopilotConfig> {
  const parsed = readConfigFile()
  const githubCopilot = parsed.githubCopilot

  return {
    username: asTrimmedString(githubCopilot?.username),
    token: asTrimmedString(githubCopilot?.token),
    plan: asTrimmedStringOrValue(githubCopilot?.plan) as GitHubCopilotPlan | undefined,
  }
}

function readOpenCodeGoOverrides(overrides: OpenCodeGoConfigOverrides | undefined): Partial<OpenCodeGoConfig> {
  if (!overrides || typeof overrides !== "object") return {}

  const nested = typeof overrides.opencodeGo === "object" && overrides.opencodeGo ? overrides.opencodeGo : undefined

  return {
    workspaceId: asTrimmedString(overrides.workspaceId ?? nested?.workspaceId),
    authCookie: asTrimmedString(overrides.authCookie ?? nested?.authCookie),
  }
}

function readGitHubCopilotOverrides(
  overrides: GitHubCopilotConfigOverrides | undefined,
): Partial<GitHubCopilotConfig> {
  if (!overrides || typeof overrides !== "object") return {}

  const nested = typeof overrides.githubCopilot === "object" && overrides.githubCopilot ? overrides.githubCopilot : undefined

  return {
    username: asTrimmedString(nested?.username),
    token: asTrimmedString(nested?.token),
    plan: asTrimmedStringOrValue(nested?.plan) as GitHubCopilotPlan | undefined,
  }
}

function asTrimmedStringOrValue(value: unknown): unknown {
  return typeof value === "string" ? asTrimmedString(value) : value
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined

  const trimmed = value.trim()
  if (!trimmed) return undefined

  const envName = parseEnvReference(trimmed)
  if (envName) {
    const resolved = process.env[envName]?.trim()
    if (!resolved) {
      throw new Error(`Environment variable ${envName} is not set.`)
    }

    return resolved
  }

  if (looksLikeEnvPlaceholder(trimmed)) {
    throw new Error(
      `Invalid environment placeholder "${trimmed}". Use {env:VARIABLE_NAME}; shell commands like {env:$(gh auth token)} are not supported.`,
    )
  }

  return trimmed
}

function parsePlan(value: unknown): GitHubCopilotPlan {
  if (value === undefined || value === null) return "pro"

  const normalized = typeof value === "string" ? value.toLowerCase().trim() : String(value)

  if (normalized === "pro+") {
    return "pro+"
  }

  if (normalized === "pro") {
    return "pro"
  }

  throw new Error("GITHUB_COPILOT_PLAN must be \"pro\" or \"pro+\".")
}

function parseEnvReference(value: string): string | null {
  const match = value.match(ENV_REFERENCE_PATTERN)
  return match ? match[1] : null
}

function looksLikeEnvPlaceholder(value: string): boolean {
  return ENV_PLACEHOLDER_PATTERN.test(value)
}
