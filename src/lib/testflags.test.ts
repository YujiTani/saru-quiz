import { afterEach, describe, expect, it, vi } from 'vitest'

async function withSearch(search: string) {
  vi.stubGlobal('location', { search })
  return import('./testflags')
}

afterEach(() => vi.unstubAllGlobals())

describe('testflags', () => {
  it('?show ?cat ?demo のどれかがあれば記録しない', async () => {
    const f = await withSearch('?show=abc')
    expect(f.isTestRun()).toBe(true)
    expect((await withSearch('?cat=どうぶつ')).isTestRun()).toBe(true)
    expect((await withSearch('?demo')).isTestRun()).toBe(true)
  })

  it('?seed ?time ?goal だけなら記録する', async () => {
    expect((await withSearch('?seed=1&time=5&goal=3')).isTestRun()).toBe(false)
    expect((await withSearch('')).isTestRun()).toBe(false)
  })

  it('?cat の値を返す', async () => {
    expect((await withSearch('?cat=どうぶつ')).catParam()).toBe('どうぶつ')
    expect((await withSearch('')).catParam()).toBeNull()
  })
})
