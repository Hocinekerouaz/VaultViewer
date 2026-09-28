export function resolveCopyText(selection: string, fallback: string): string {
  return selection.trim().length > 0 ? selection : fallback
}
