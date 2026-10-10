import { describe, expect, it } from 'vitest'
import voiceLines from '../../scripts/voice_lines.py?raw'
import { BANANA_STAGES, bananaStage, stageUp } from './banana'

describe('バナナのやま 段階', () => {
  it('7段階。しきい値は昇順で、後ろの段ほど間が遠くなる', () => {
    expect(BANANA_STAGES).toHaveLength(7)
    expect(BANANA_STAGES[0].need).toBe(0)
    const needs = BANANA_STAGES.map((s) => s.need)
    expect([...needs].sort((a, b) => a - b)).toEqual(needs)
    const gaps = needs.slice(1).map((n, i) => n - needs[i])
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1])
  })

  it('id・読み上げは重ならず、読み上げは「、」でくぎったひらがな・カタカナ', () => {
    expect(new Set(BANANA_STAGES.map((s) => s.id)).size).toBe(7)
    for (const s of BANANA_STAGES) expect(s.say).toMatch(/^[ぁ-んァ-ヶー、！]+$/u)
  })

  it('合計バナナから段階が決まる（しきい値ちょうどで上がる）', () => {
    expect(bananaStage(0)).toBe(0)
    expect(bananaStage(BANANA_STAGES[1].need - 1)).toBe(0)
    expect(bananaStage(BANANA_STAGES[1].need)).toBe(1)
    expect(bananaStage(BANANA_STAGES[6].need - 1)).toBe(5)
    expect(bananaStage(BANANA_STAGES[6].need)).toBe(6)
    expect(bananaStage(10_000_000)).toBe(6)
  })

  it('最初の段は 2〜3回で上がる（1回 150〜500 くらいもらえるとして）', () => {
    expect(BANANA_STAGES[1].need).toBeGreaterThanOrEqual(300)
    expect(BANANA_STAGES[1].need).toBeLessThanOrEqual(1500)
  })

  it('stageUp: プレイの前後で段階が上がったときだけ、新しい段階を返す', () => {
    const n = BANANA_STAGES
    expect(stageUp(n[1].need - 1, n[1].need)).toBe(1)
    expect(stageUp(0, n[3].need + 5)).toBe(3) // 一度に何段か
    expect(stageUp(10, 20)).toBeNull()
    expect(stageUp(n[1].need, n[1].need + 10)).toBeNull()
    expect(stageUp(n[2].need, n[2].need - 1)).toBeNull() // へることはないが、下がっても何も出さない
  })
  it('読み上げ（say）は scripts/voice_lines.py にもある（無いと声が合成音声になる）', () => {
    const py = voiceLines
    for (const s of BANANA_STAGES) expect(py, s.say).toContain(`'${s.say}'`)
    for (const t of ['はい、ちーず！', 'シールを、もらったよ！', 'シールが、ぜんぶ、そろったよ！']) expect(py, t).toContain(`'${t}'`)
  })
})
