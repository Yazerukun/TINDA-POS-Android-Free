import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FirstRun } from '../FirstRun'

describe('FirstRun setup wizard', () => {
  it('renders successfully without throwing ReferenceError for tindaLogo or other assets', () => {
    expect(() => {
      const html = renderToStaticMarkup(React.createElement(FirstRun))
      expect(html).toContain('img')
      expect(html).toContain('A few quick steps to get your store running')
    }).not.toThrow()
  })
})
