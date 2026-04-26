import type { GitHubCopilotSnapshot } from "./github-copilot.js"
import type { OpenCodeGoSnapshot } from "./opencode-go.js"

export const BAR_SEGMENTS = 24

const CARD_DIVIDER = "-".repeat(40)
const RIGHT_ALIGN_SEPARATOR = "\t"

export type UsageSeverity = "success" | "warning" | "error"

export type UsageWindowView = {
  key: "rolling" | "weekly" | "monthly"
  label: string
  usagePercent: number
  resetText: string
  severity: UsageSeverity
  filledSegments: number
}

export type UsageDialogView = {
  providerLabel: string
  categoryLabel: string
  updatedAt: string
  windows: UsageWindowView[]
}

export function buildUsageDialogView(snapshot: OpenCodeGoSnapshot): UsageDialogView {
  const windows: UsageWindowView[] = []

  if (snapshot.rolling) {
    windows.push(toWindowView("rolling", "Rolling", snapshot.rolling.usagePercent, snapshot.rolling.resetInSec))
  }

  if (snapshot.weekly) {
    windows.push(toWindowView("weekly", "Weekly", snapshot.weekly.usagePercent, snapshot.weekly.resetInSec))
  }

  if (snapshot.monthly) {
    windows.push(toWindowView("monthly", "Monthly", snapshot.monthly.usagePercent, snapshot.monthly.resetInSec))
  }

  return {
    providerLabel: "OpenCode Go",
    categoryLabel: "subscription",
    updatedAt: formatTimestamp(snapshot.fetchedAt),
    windows,
  }
}

export function formatOpenCodeGoMessage(snapshot: OpenCodeGoSnapshot): string {
  const view = buildUsageDialogView(snapshot)
  const parts = [formatMessageHeader(view.providerLabel, view.categoryLabel, view.updatedAt), ""]

  if (view.windows.length > 0) {
    parts.push(...view.windows.map(formatWindowRow))
  } else {
    parts.push(formatMetricLine("Usage", "No usage windows available"))
  }

  return parts.join("\n")
}

export function formatGitHubCopilotMessage(snapshot: GitHubCopilotSnapshot): string {
  const usageText =
    snapshot.monthlyAllowance === null
      ? `${formatCount(snapshot.usedPremiumRequests)} used (unlimited)`
      : `${formatCount(snapshot.usedPremiumRequests)} / ${formatCount(snapshot.monthlyAllowance)} (${formatPercent(
        snapshot.usagePercent,
      )})`
  const parts = [
    formatMessageHeader("GitHub Copilot", "premium requests", formatTimestamp(snapshot.fetchedAt)),
    "",
    formatMetricLine("Month", formatUsageMonth(snapshot.usageMonth.year, snapshot.usageMonth.month)),
    formatMetricLine("Usage", usageText),
    formatMetricLine("Overage", formatCount(snapshot.overageRequests)),
    formatMetricLine("Reset in", formatDurationUntil(snapshot.resetAt)),
  ]

  if (snapshot.source === "billing") {
    parts.push(CARD_DIVIDER, formatMetricLine("Source", "billing fallback"))
  }

  return parts.join("\n")
}

export function formatUsageMessage(messages: string[]): string {
  const cards = messages.map((message) => message.split("\n"))
  const width = cards.reduce(
    (maxWidth, lines) => Math.max(maxWidth, lines.reduce((lineMax, line) => Math.max(lineMax, getLineWidth(line)), 0)),
    0,
  )
  const height = cards.reduce((maxHeight, lines) => Math.max(maxHeight, lines.length), 0)

  return cards.map((lines) => formatCard(lines, width, height)).join("\n\n")
}

export function formatUsageLoadingMessage(frame: string): string {
  return `${frame} Loading ...\n\nFetching configured providers. This can take a few seconds.`
}

function formatMessageHeader(providerLabel: string, categoryLabel: string, updatedAt: string): string {
  return [`[${providerLabel}] [${categoryLabel}]`, `Updated: ${updatedAt}`].join("\n")
}

function formatCard(lines: string[], width: number, height: number): string {
  const border = `+${"-".repeat(width + 2)}+`
  const paddedLines = [...lines, ...Array.from({ length: height - lines.length }, () => "")]

  return [border, ...paddedLines.map((line) => `| ${formatCardLine(line, width)} |`), border].join("\n")
}

function getLineWidth(line: string): number {
  const [left, right] = splitRightAlignedLine(line)
  if (!right) return line.length

  return left.length + right.length + 1
}

function formatCardLine(line: string, width: number): string {
  const [left, right] = splitRightAlignedLine(line)
  if (!right) return line.padEnd(width, " ")

  const spacing = " ".repeat(Math.max(1, width - left.length - right.length))
  return `${left}${spacing}${right}`
}

function splitRightAlignedLine(line: string): [string, string | undefined] {
  const separatorIndex = line.indexOf(RIGHT_ALIGN_SEPARATOR)
  if (separatorIndex === -1) return [line, undefined]

  return [line.slice(0, separatorIndex), line.slice(separatorIndex + RIGHT_ALIGN_SEPARATOR.length)]
}

function formatWindowRow(window: UsageWindowView): string {
  const label = `${window.label}:`.padEnd(8, " ")
  const percent = `${window.usagePercent}%`.padStart(4, " ")

  return `${label} ${formatBar(window.usagePercent)} ${percent} ${window.resetText}`
}

function toWindowView(
  key: UsageWindowView["key"],
  label: string,
  usagePercent: number,
  resetInSec: number,
): UsageWindowView {
  const clamped = Math.max(0, Math.min(100, usagePercent))

  return {
    key,
    label,
    usagePercent: clamped,
    resetText: formatDuration(resetInSec),
    severity: getSeverity(clamped),
    filledSegments: Math.round((clamped / 100) * BAR_SEGMENTS),
  }
}

function getSeverity(usagePercent: number): UsageSeverity {
  if (usagePercent >= 80) return "error"
  if (usagePercent >= 50) return "warning"
  return "success"
}

function formatBar(usagePercent: number): string {
  const clamped = Math.max(0, Math.min(100, usagePercent))
  const filledSegments = Math.round((clamped / 100) * BAR_SEGMENTS)
  const filled = "#".repeat(filledSegments)
  const empty = "-".repeat(BAR_SEGMENTS - filledSegments)

  return `[${filled}${empty}]`
}

function formatMetricLine(label: string, value: string): string {
  return `${label}: ${value}`
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  })
}

export function formatCount(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.max(0, Math.floor(totalSeconds))}s`

  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    return `${minutes}m`
  }

  if (totalSeconds < 86400) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

function formatUsageMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  })
}

function formatDurationUntil(timestamp: number): string {
  return formatDuration(Math.max(0, Math.floor((timestamp - Date.now()) / 1000)))
}

function formatOverageCost(amountUsd: number): string {
  if (amountUsd <= 0) return ""
  return ` · $${amountUsd.toFixed(2)}`
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`
}
