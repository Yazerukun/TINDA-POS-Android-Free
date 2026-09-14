import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { money } from '@shared/format'
import { Dashboard } from '../Dashboard'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>()
  return { ...actual, useState: vi.fn(), useEffect: vi.fn() }
})

afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals() })

describe('dashboard net sales', () => {
  it('reloads all totals on inventory events and cleans up subscriptions', async () => {
    vi.stubGlobal('React', React)
    const setState = vi.fn()
    vi.mocked(React.useState).mockImplementation(() => [null, setState] as ReturnType<typeof React.useState>)
    const sales = vi.fn().mockResolvedValue({ summary: { sales_total_c: 50000, refunds_c: 0 } })
    const onChanged = vi.fn().mockReturnValue(vi.fn())
    const fakeWindow = {
      api: {
        reports: { sales, utang: vi.fn().mockResolvedValue({ total_outstanding_c: 0 }) },
        products: { search: vi.fn().mockResolvedValue({ rows: [] }) },
        transactions: { list: vi.fn().mockResolvedValue({ rows: [] }) },
        inventory: { onChanged }
      },
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      setInterval: vi.fn().mockReturnValue(7), clearInterval: vi.fn()
    }
    vi.stubGlobal('window', fakeWindow)
    renderToStaticMarkup(React.createElement(Dashboard))
    const cleanup = vi.mocked(React.useEffect).mock.calls[0]![0]()
    await vi.waitFor(() => expect(setState).toHaveBeenCalledWith({ sales_total_c: 50000, refunds_c: 0 }))
    sales.mockResolvedValue({ summary: { sales_total_c: 50000, refunds_c: 50000 } })
    onChanged.mock.calls[0]![0]()
    await vi.waitFor(() => expect(setState).toHaveBeenCalledWith({ sales_total_c: 50000, refunds_c: 50000 }))
    expect(sales).toHaveBeenCalledTimes(2)
    if (typeof cleanup === 'function') cleanup()
    expect(onChanged.mock.results[0]!.value).toHaveBeenCalledOnce()
    expect(fakeWindow.clearInterval).toHaveBeenCalledWith(7)
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('focus', expect.any(Function))
  })

  it.each([
    { refunds: 0, net: 50000 },
    { refunds: 10000, net: 40000 },
    { refunds: 50000, net: 0 }
  ])('shows $net cents after $refunds cents refunded', ({ refunds, net }) => {
    vi.stubGlobal('React', React)
    const states = [
      { sales_total_c: 50000, refunds_c: refunds, transactions: 1, profit_c: 0, items_sold: 1, expenses_c: 0 },
      [], [], 0, null
    ]
    vi.mocked(React.useState).mockImplementation(() => [states.shift(), vi.fn()] as ReturnType<typeof React.useState>)
    const html = renderToStaticMarkup(React.createElement(Dashboard))
    expect(html).toContain('Today&#x27;s Net Sales')
    expect(html).toContain(`>${money(net)}</p>`)
    expect(html).toContain(`Refunds: ${money(refunds)}`)
  })
})
