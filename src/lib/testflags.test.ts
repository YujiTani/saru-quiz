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

  it('?hap=<id> は記録しない・id を返す。?hap=off は記録する・強制ではない', async () => {
    const f = await withSearch('?hap=hap:ufo')
    expect(f.isTestRun()).toBe(true)
    expect(f.hapForced()).toBe('hap:ufo')
    const off = await withSearch('?hap=off&seed=1')
    expect(off.isTestRun()).toBe(false)
    expect(off.hapForced()).toBeNull()
    expect(off.hapOff()).toBe(true)
    expect((await withSearch('')).hapForced()).toBeNull()
    expect((await withSearch('?seed=7')).seedSalt()).toBe('7')
  })
})
