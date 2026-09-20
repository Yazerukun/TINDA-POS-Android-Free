import { useMemo } from 'react'
import type { ReceiptWidth } from '@shared/receiptHtml'
import { receiptBodyHtml, receiptCss } from '@shared/receiptHtml'
import { useSettings } from '../stores/settings'

interface ReceiptPaperProps {
  lines: string[]
  width?: ReceiptWidth
}

/**
 * On-screen approximation of the printed thermal receipt. It renders the exact
 * same HTML/CSS used by the silent print path (see shared/receiptHtml.ts), so
 * what you see here is what the printer receives. User text is escaped by the
 * builder before reaching this innerHTML.
 */
export function ReceiptPaper({ lines, width }: ReceiptPaperProps): React.JSX.Element {
  const { settings } = useSettings()
  const paper: ReceiptWidth = width ?? settings?.receipt_paper_width ?? '80mm'
  const css = useMemo(() => receiptCss(paper), [paper])
  const body = useMemo(() => receiptBodyHtml(lines, paper, settings?.currency), [lines, paper, settings?.currency])

  return (
    <div className="flex justify-center bg-ink-950 px-2 py-4 sm:p-6 rounded-lg overflow-x-auto shadow-inner min-h-[40vh] max-h-[60vh] overflow-y-auto">
      <div className="shadow-xl rounded-sm max-w-full">
        <style>{css}</style>
        {/* Receipt HTML is fully escaped in shared/receiptHtml.ts — no raw user HTML. */}
        <div dangerouslySetInnerHTML={{ __html: body }} className="bg-white rounded-sm shadow-sm" />
      </div>
    </div>
  )
}
