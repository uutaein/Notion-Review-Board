/**
 * @file fsrs-engine.ts
 * @description 도메인 데이터 사양과 외부 FSRS 모듈(`ts-fsrs`)의 중간 다리 역할을 수행하는 어댑터 레이어입니다.
 *
 * SRS-FR-072 설계 요구사항에 의거하여 클래스 인스턴스 형태의 원시 데이터는 배제하고,
 * 호환 버전 확인 검사 기능 및 안전한 JSON 직렬화 가능 상태 페이로드 변환 기능만을 엄격하게 담당합니다.
 */

import { createEmptyCard, fsrs, Card } from 'ts-fsrs'
import { FsrsState } from '../../../shared/domain/item'
import { FsrsRatingValue } from '../../../shared/domain/log'
import { DateTimeString } from '../../../shared/domain/types'

/**
 * 다음 복습 주기를 계산해내기 위해 어댑터가 건네받는 인풋 사양 규격입니다.
 */
export interface ScheduleInput {
  /** 아이템에 저장되어 있는 기존 FSRS 버전 상태 정보 */
  state: FsrsState
  /** [1, 4] 범위값으로 이미 치환된 FSRS 표준 등급 평점 */
  rating: FsrsRatingValue
  /** 사용자가 실제로 복습을 완료하여 평점을 부여한 UTC 시각 기준점 */
  reviewedAt: DateTimeString
}

/**
 * 어댑터 연산 결과물로 반환되는 아웃풋 사양 규격입니다.
 */
export interface ScheduleResult {
  /** 연산 처리 결과로 새롭게 지정된 다음 복습 마감 UTC 일시 */
  dueAt: DateTimeString
  /** 다음 복습 세션에 인풋으로 다시 넘겨줄 갱신용 버전화 FSRS 상태 페이로드 */
  state: FsrsState
}

/**
 * FSRS 상태 계산 어댑터 엔진 인터페이스입니다.
 */
export interface FsrsEngine {
  /** 신규 등록된 아이템을 위한 최초 복습 기준 초기 스키마 상태 페이로드를 생성합니다. */
  createInitialState(reviewedAt: DateTimeString): FsrsState
  /** ts-fsrs 스케줄러 라이브러리 연산을 거쳐 문자열 시간과 변경 데이터 세트를 담은 결과를 반환합니다. */
  schedule(input: ScheduleInput): ScheduleResult
}

/**
 * FSRS 상태 연산 엔진 어댑터 객체를 생성하는 팩토리 함수입니다.
 *
 * 외부 라이브러리인 `ts-fsrs` 모듈과의 원활한 상호작용을 처리하되, 외부 라이브러리의 Date 객체 형식과
 * 순수 JSON 포맷(ISO 문자열 기반 구조) 간의 맵 브릿지 역할을 담당합니다.
 *
 * @returns FsrsEngine 인터페이스 구현 어댑터 인스턴스
 */
export function createFsrsEngine(): FsrsEngine {
  /** 현재 어댑터 계산 방식과 호환성을 가지는 구체적 버전 문자열 정보 */
  const version = 'ts-fsrs@5'
  
  /** 실제 계산 연산을 위임하여 수행시킬 코어 라이브러리 싱글톤 인스턴스 */
  const f = fsrs()

  return {
    createInitialState(reviewedAt: DateTimeString): FsrsState {
      // 지정된 첫 복습 완료 시간 정보를 바탕으로 ts-fsrs 라이브러리의 기본 카드 구조를 생성합니다.
      const card = createEmptyCard(new Date(reviewedAt))
      
      // JSON 호환성 및 영속화를 보장하기 위해 라이브러리 전용 Date 타입을 ISO 8601 UTC 문자열로 변환 직렬화합니다.
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
      // 보관된 데이터 스키마가 현재 가동중인 버전 규격('ts-fsrs@5')과 불일치할 경우 갱신 거부 차단 처리합니다.
      if (state.version !== version) {
        throw new Error(`Incompatible version: ${state.version}`)
      }

      // 인풋 인자의 불필요한 레퍼런스 변조 방지를 목적으로 구조 복사 사본을 확보합니다.
      const stateCopy = structuredClone(state)

      // 저장된 문자열 필드들을 다시 외부 라이브러리가 해석 가능한 Date 객체 형태로 파싱 및 재생성합니다.
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

      // ts-fsrs 계산 코어 로직을 실행하여 다음 스케줄 주기 연산을 위임합니다.
      const result = f.next(card, new Date(reviewedAt), rating)

      // 라이브러리가 반환한 원시 Date 객체 정보들을 최종 JSON 영속화 스키마 및 UTC 형식의 문자열로 다시 매핑합니다.
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
