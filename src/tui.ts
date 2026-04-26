import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import {
  loadOptionalGitHubCopilotConfig,
  loadOptionalOpenCodeGoConfig,
  type PluginConfigOverrides,
} from "./config.js"
import {
  formatGitHubCopilotMessage,
  formatOpenCodeGoMessage,
  formatUsageLoadingMessage,
  formatUsageMessage,
} from "./format.js"
import { getGitHubCopilotUsage } from "./github-copilot.js"
import { getOpenCodeGoUsage } from "./opencode-go.js"

const COMMAND_VALUE = "model-usage.show"
const LOADING_FRAMES = ["|", "/", "-", "\\"]

let activeUsageRequestId = 0
let stopActiveLoading: (() => void) | undefined

const tui: TuiPlugin = async (api, options) => {
  const configOverrides = options as PluginConfigOverrides | undefined

  api.command.register(() => [
    {
      title: "Model Usage Overview",
      value: COMMAND_VALUE,
      description: "Show AI quota and subscription usage",
      category: "Usage",
      suggested: true,
      slash: {
        name: "model-usage",
        aliases: ["go-usage", "copilot-usage"],
      },
      onSelect: () => showUsageDialog(api, configOverrides),
    },
  ])
}

async function showUsageDialog(
  api: Parameters<TuiPlugin>[0],
  configOverrides: PluginConfigOverrides | undefined,
): Promise<void> {
  stopActiveLoading?.()

  const requestId = ++activeUsageRequestId
  let loadingFrame = 0
  let loadingTimer: ReturnType<typeof setInterval> | undefined
  const stopLoading = () => {
    if (loadingTimer) {
      clearInterval(loadingTimer)
      loadingTimer = undefined
    }

    if (stopActiveLoading === stopLoading) {
      stopActiveLoading = undefined
    }
  }
  const closeLoadingDialog = () => {
    if (activeUsageRequestId === requestId) {
      activeUsageRequestId++
    }

    stopLoading()

    api.ui.dialog.clear()
  }
  const renderLoadingDialog = () => {
    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Model Usage Overview",
        message: formatUsageLoadingMessage(LOADING_FRAMES[loadingFrame]),
        onConfirm: closeLoadingDialog,
      }),
    )
  }

  stopActiveLoading = stopLoading
  renderLoadingDialog()
  loadingTimer = setInterval(() => {
    if (activeUsageRequestId !== requestId) return

    loadingFrame = (loadingFrame + 1) % LOADING_FRAMES.length
    renderLoadingDialog()
  }, 180)

  try {
    const message = await buildUsageMessage(configOverrides)

    if (activeUsageRequestId !== requestId) return
    stopLoading()

    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Model Usage Overview",
        message,
        onConfirm: () => api.ui.dialog.clear(),
      }),
    )
  } catch (error) {
    if (activeUsageRequestId !== requestId) return

    stopLoading()

    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Model Usage Overview Error",
        message: error instanceof Error ? error.message : "Failed to fetch usage.",
        onConfirm: () => api.ui.dialog.clear(),
      }),
    )
  } finally {
    stopLoading()
  }
}

async function buildUsageMessage(
  configOverrides: PluginConfigOverrides | undefined,
): Promise<string> {
  const tasks: Array<Promise<string>> = []
  const errors: string[] = []

  try {
    if (loadOptionalOpenCodeGoConfig(configOverrides)) {
      tasks.push(getOpenCodeGoUsage(configOverrides).then(formatOpenCodeGoMessage))
    }
  } catch (error) {
    errors.push(errorMessage(error))
  }

  try {
    if (loadOptionalGitHubCopilotConfig(configOverrides)) {
      tasks.push(getGitHubCopilotUsage(configOverrides).then(formatGitHubCopilotMessage))
    }
  } catch (error) {
    errors.push(errorMessage(error))
  }

  if (tasks.length === 0) {
    if (errors.length > 0) {
      throw new Error(errors.join("\n\n"))
    }

    throw new Error(
      "No usage providers are configured. Set OpenCode Go and/or GitHub Copilot credentials in tui.json, environment variables, or opencode-model-usage.json.",
    )
  }

  const results = await Promise.allSettled(tasks)
  const messages: string[] = []

  for (const result of results) {
    if (result.status === "fulfilled") {
      messages.push(result.value)
      continue
    }

    errors.push(errorMessage(result.reason))
  }

  if (messages.length === 0) {
    throw new Error(errors.join("\n\n"))
  }

  if (errors.length > 0) {
    messages.push(`Provider errors:\n- ${errors.join("\n- ")}`)
  }

  return formatUsageMessage(messages)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to fetch usage."
}

const plugin: TuiPluginModule & { id: string } = {
  id: "gy.model-status",
  tui,
}

export default plugin
