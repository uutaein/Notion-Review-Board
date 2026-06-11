import { describe, expect, it } from 'vitest'
import { FSRS_RATING } from '../../../../shared/domain/log'
import { createFsrsEngine } from '../fsrs-engine'
import { reviewedAt } from './fixtures'

describe('FSRS engine adapter', () => {
  it('creates a versioned JSON-serializable initial state', () => {
    const engine = createFsrsEngine()

    const state = engine.createInitialState(reviewedAt)

    expect(state.version).toMatch(/^ts-fsrs@/)
    expect(state.version.length).toBeGreaterThan('ts-fsrs@'.length)
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })

  it.each([
    ['again', FSRS_RATING.Again],
    ['hard', FSRS_RATING.Hard],
    ['good', FSRS_RATING.Good],
    ['easy', FSRS_RATING.Easy]
  ] as const)('schedules the %s rating without exposing library objects', (_, rating) => {
    const engine = createFsrsEngine()
    const initialState = engine.createInitialState(reviewedAt)

    const result = engine.schedule({
      state: initialState,
      rating,
      reviewedAt
    })

    expect(Date.parse(result.dueAt)).toBeGreaterThan(Date.parse(reviewedAt))
    expect(result.state.version).toBe(initialState.version)
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state)
  })

  it('is deterministic for the same state, rating, and review time', () => {
    const engine = createFsrsEngine()
    const state = engine.createInitialState(reviewedAt)
    const input = {
      state,
      rating: FSRS_RATING.Good,
      reviewedAt
    }

    expect(engine.schedule(input)).toEqual(engine.schedule(input))
  })

  it('does not mutate the persisted input state', () => {
    const engine = createFsrsEngine()
    const state = engine.createInitialState(reviewedAt)
    const snapshot = structuredClone(state)

    engine.schedule({
      state,
      rating: FSRS_RATING.Good,
      reviewedAt
    })

    expect(state).toEqual(snapshot)
  })

  it('rejects a state produced by an incompatible adapter version', () => {
    const engine = createFsrsEngine()

    expect(() =>
      engine.schedule({
        state: { version: 'other-fsrs@1', payload: {} },
        rating: FSRS_RATING.Good,
        reviewedAt
      })
    ).toThrow(/version/i)
  })
})
