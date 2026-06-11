import { createEmptyCard, fsrs, Card } from 'ts-fsrs'
import { FsrsState } from '../../../shared/domain/item'
import { FsrsRatingValue } from '../../../shared/domain/log'
import { DateTimeString } from '../../../shared/domain/types'

export interface ScheduleInput {
  state: FsrsState
  rating: FsrsRatingValue
  reviewedAt: DateTimeString
}

export interface ScheduleResult {
  dueAt: DateTimeString
  state: FsrsState
}

export interface FsrsEngine {
  createInitialState(reviewedAt: DateTimeString): FsrsState
  schedule(input: ScheduleInput): ScheduleResult
}

export function createFsrsEngine(): FsrsEngine {
  const version = 'ts-fsrs@5'
  const f = fsrs()

  return {
    createInitialState(reviewedAt: DateTimeString): FsrsState {
      const card = createEmptyCard(new Date(reviewedAt))
      return {
        version,
        payload: {
          due: card.due.toISOString(),
          stability: card.stability,
          difficulty: card.difficulty,
          elapsed_days: card.elapsed_days,
          scheduled_days: card.scheduled_days,
          reps: card.reps,
          lapses: card.lapses,
          state: card.state,
          last_review: card.last_review ? card.last_review.toISOString() : null,
          learning_steps: card.learning_steps
        }
      }
    },

    schedule({ state, rating, reviewedAt }: ScheduleInput): ScheduleResult {
      if (state.version !== version) {
        throw new Error(`Incompatible version: ${state.version}`)
      }

      // Clone the state payload to avoid mutating input state
      const stateCopy = structuredClone(state)

      const card: Card = {
        due: new Date(stateCopy.payload.due as string),
        stability: stateCopy.payload.stability as number,
        difficulty: stateCopy.payload.difficulty as number,
        elapsed_days: stateCopy.payload.elapsed_days as number,
        scheduled_days: stateCopy.payload.scheduled_days as number,
        reps: stateCopy.payload.reps as number,
        lapses: stateCopy.payload.lapses as number,
        state: stateCopy.payload.state as number,
        last_review: stateCopy.payload.last_review ? new Date(stateCopy.payload.last_review as string) : undefined,
        learning_steps: (stateCopy.payload.learning_steps as number) ?? 0
      }

      const result = f.next(card, new Date(reviewedAt), rating)

      return {
        dueAt: result.card.due.toISOString() as DateTimeString,
        state: {
          version: stateCopy.version,
          payload: {
            due: result.card.due.toISOString(),
            stability: result.card.stability,
            difficulty: result.card.difficulty,
            elapsed_days: result.card.elapsed_days,
            scheduled_days: result.card.scheduled_days,
            reps: result.card.reps,
            lapses: result.card.lapses,
            state: result.card.state,
            last_review: result.card.last_review ? result.card.last_review.toISOString() : null,
            learning_steps: result.card.learning_steps
          }
        }
      }
    }
  }
}
