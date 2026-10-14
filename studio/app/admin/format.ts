export const dateTime = (ms: number) =>
  new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

export const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

export const STATUS_LABEL: Record<string, string> = {
  pending_submit: "Submitting",
  queued: "Queued",
  in_progress: "Running",
  completed: "Completed",
  failed: "Failed",
  nsfw: "Blocked",
  canceled: "Canceled",
}
