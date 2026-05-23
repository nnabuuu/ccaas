/**
 * Short-code share dialog — admin playground UI for §18.
 *
 * Lets a story author mint a deterministic-or-random short code pointing at
 * the active (bundleId, storyName), copy the resulting share URL, and prune
 * old codes from the same dialog. All backed by /preview/shortcodes routes
 * exposed by preview-server.ts.
 */
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ShortCodeEntry {
  code: string
  bundleId: string
  storyName: string
  expiresAt?: number
  createdAt: number
  notes?: string
}

interface Props {
  previewUrl: string
  /** Currently selected bundle + story (button disables when null). */
  bundleId: string | null
  storyName: string | null
}

export function ShortCodesDialog({ previewUrl, bundleId, storyName }: Props) {
  const [open, setOpen] = useState(false)
  const [codes, setCodes] = useState<ShortCodeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${previewUrl}/preview/shortcodes`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = (await r.json()) as { codes: ShortCodeEntry[] }
      setCodes(json.codes)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [previewUrl])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const create = async (deterministic: boolean) => {
    if (!bundleId || !storyName) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`${previewUrl}/preview/shortcodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId,
          storyName,
          ...(deterministic && { deterministic: true }),
          ...(notes && { notes }),
        }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
      setNotes('')
      void refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (code: string) => {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`${previewUrl}/preview/shortcodes/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      })
      if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`)
      void refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const shareUrl = (code: string) => `${previewUrl}/p/${code}`

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(code))
      setCopied(code)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // navigator.clipboard fails in non-HTTPS contexts; let the user select
      // the text manually rather than throwing a dialog at them.
      setError('Clipboard unavailable — copy the URL manually.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!bundleId || !storyName}>
          Share Link
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Share Codes · {bundleId} · {storyName}</DialogTitle>
        </DialogHeader>

        {/* Mint a new code */}
        <div className="border rounded p-3 space-y-2">
          <div className="text-xs font-semibold">Mint new short code</div>
          <div className="flex gap-2">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional — e.g. 'spring 2026 demo')"
              className="text-xs h-8"
            />
            <Button size="sm" variant="outline" onClick={() => void create(false)} disabled={busy}>
              Random
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void create(true)}
              disabled={busy}
              title="Deterministic codes are derived from bundleId+storyName — same story always yields the same code."
            >
              Deterministic
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Existing codes */}
        <div>
          <div className="flex items-center mb-2">
            <span className="text-xs font-semibold">Existing codes</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void refresh()} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {codes.length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 text-center">
                No share codes yet.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-1.5 pr-2">Code</th>
                    <th className="pr-2">Target</th>
                    <th className="pr-2">Notes</th>
                    <th className="pr-2">Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.code} className="border-b last:border-b-0">
                      <td className="py-1.5 pr-2 font-mono">{c.code}</td>
                      <td className="pr-2">
                        <Badge variant="outline" className="text-[10px]">{c.bundleId}</Badge>
                        <span className="ml-1">{c.storyName}</span>
                      </td>
                      <td className="pr-2 text-muted-foreground max-w-[140px] truncate">
                        {c.notes ?? ''}
                      </td>
                      <td className="pr-2 text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString()}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[10px] h-6 px-2"
                          onClick={() => void copyToClipboard(c.code)}
                        >
                          {copied === c.code ? '✓ Copied' : 'Copy URL'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[10px] h-6 px-2 text-red-600"
                          onClick={() => void remove(c.code)}
                          disabled={busy}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
