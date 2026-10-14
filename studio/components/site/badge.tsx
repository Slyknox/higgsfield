import type { ModelBadge } from "@/lib/site/model-meta"
import { cn } from "@/lib/utils"

/** Small italic tag next to a model name ("TOP", "NEW", ...). */
export function Badge({
  children,
  className,
}: {
  children: ModelBadge | string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] bg-primary px-1.5 py-px text-[10px] leading-4 font-bold text-primary-foreground italic",
        className
      )}
    >
      {children}
    </span>
  )
}
