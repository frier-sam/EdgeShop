// frontend/src/admin/print/downloadPrintFiles.ts
//
// POD.md §4.2 / §8.3 — turning rendered print-file Blobs into an actual
// browser download, one file at a time or as one zip for the whole order.
//
// Zip vs sequential decision (see POD.md decisions log): a real zip, via
// `fflate`. `fflate`'s `zipSync` is ~8KB min+gzip, has zero dependencies,
// and needs no Node/Buffer polyfill (pure Uint8Array in, Uint8Array out) —
// small enough that "keep it small and lazy-loaded" is satisfied by a
// single `import('fflate')` inside `downloadAllPrintFiles`, exactly like
// Fabric is lazy-loaded for the renderer itself. Sequential
// browser-triggered downloads were the fallback under consideration, but
// most browsers throttle/prompt after a handful of programmatic downloads
// fired in a loop (Chrome shows a "downloading multiple files" permission
// gate past ~5), which would make "Download all" for a 10-line order an
// unreliable UX — a single zip sidesteps that entirely.
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Revoke on a delay — Safari has been known to cancel the download if
    // the object URL is revoked before the click has been fully processed.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export interface NamedPrintFile {
  filename: string
  blob: Blob
}

/** POD.md §8.2 — `<order_id>-<line_index>-<side>.png`. */
export function printFileName(orderId: string, lineIndex: number, side: string): string {
  return `${orderId}-${lineIndex}-${side}.png`
}

export async function downloadAllPrintFiles(orderId: string, files: NamedPrintFile[]): Promise<void> {
  if (files.length === 0) return
  const { zipSync } = await import('fflate')
  const entries: Record<string, Uint8Array> = {}
  for (const file of files) {
    entries[file.filename] = new Uint8Array(await file.blob.arrayBuffer())
  }
  // level: 0 — PNGs are already compressed; re-compressing costs CPU for
  // no size benefit, so this zip is a plain container (store-only).
  const zipped = zipSync(entries, { level: 0 })
  const blob = new Blob([zipped as BlobPart], { type: 'application/zip' })
  triggerBlobDownload(blob, `${orderId}-print-files.zip`)
}
