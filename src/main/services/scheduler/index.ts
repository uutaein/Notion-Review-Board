/**
 * @file index.ts (스케줄러 서비스)
 * @description 복습 항목에 대한 평점 반영 동작, 비즈니스 규칙 검증, FSRS 알고리즘 엔진을 통한 다음 예정일 연산,
 * 그리고 복습 영속성 로그 기록 트랜잭션을 조율하는 애플리케이션 서비스 레이어입니다.
 *
 * SRS-FR-070 및 SRS-FR-071 요구사항을 구현합니다.
 */

import type { FsrsState, ReviewItem } from '../../../shared/domain/item'
import { AppRating, mapAppRatingToFsrs, ReviewLog } from '../../../shared/domain/log'
import type { DateTimeString, ReviewItemId, ReviewLogId } from '../../../shared/domain/types'

/**
 * FSRS 주기가 반환해야 하는 계산 코어 엔진 명세입니다.
 */
export interface SchedulingEngine {
  /**
   * 지정된 최초 복습 시점에 맞추어 기본 FSRS 상태 스키마를 초기화합니다.
   *
   * @param reviewedAt - 최초 복습 시점 문자열
   * @returns 초기화 설정된 FsrsState 페이로드
   */
  createInitialState(reviewedAt: DateTimeString): FsrsState

  /**
   * 다음 복습 예정 시점과 변경된 복습 상태 스냅샷을 연산해 반환합니다.
   *
   * @param input - FSRS 스케줄 계산에 필요한 인풋 매개변수 (이전 상태 정보, 복습 등급 평점, 복습 완료 일시)
   * @returns 연산 완료된 다음 dueAt 일시 및 업데이트된 FsrsState 데이터 페이로드
   */
  schedule(input: { state: FsrsState; rating: number; reviewedAt: DateTimeString }): {
    dueAt: DateTimeString
    state: FsrsState
  }
}

/**
 * 복습 기록 처리를 위한 영속성 관리 인터페이스입니다.
 */
export interface ReviewPersistence {
  /**
   * 주어진 고유 ID에 부합하는 복습 항목 엔티티를 찾아 반환합니다.
   *
   * @param id - 찾을 복습 항목 고유 식별자
   * @returns 복습 항목 정보 객체, 해당하는 데이터를 찾지 못하면 null
   */
  findReviewItemById(id: ReviewItemId): ReviewItem | null

  /**
   * 데이터베이스 등의 영속성 영역에 업데이트된 복습 항목 및 신규 이력 기록 로그를 동시에 저장합니다.
   *
   * @param item - 업데이트 완료된 신규 복습 항목 정보
   * @param log - 생성 완료된 복습 세션 이력 로그
   */
  recordReview(item: ReviewItem, log: ReviewLog): void
}

/**
 * 스케줄링 서비스 초기화에 필요한 외부 주입 의존성 구조 사양입니다.
 */
export interface SchedulingServiceDependencies {
  /** FSRS 알고리즘 계산을 위임할 엔진 어댑터 */
  engine: SchedulingEngine
  /** 데이터 조회 및 갱신 트랜잭션을 처리해줄 영속성 인터페이스 */
  persistence: ReviewPersistence
  /** 신규 생성될 이력 기록 로그용 고유 ID 생성 유틸리티 함수 */
  createReviewLogId: () => ReviewLogId
}

/**
 * 복습 평점을 적용하기 위해 공급받는 입력 요청 모델 규격입니다.
 */
export interface RateReviewInput {
  /** 복습 타겟 항목의 고유 ID */
  reviewItemId: ReviewItemId
  /** 사용자가 입력한 복습 평점 등급 ('again' | 'hard' | 'good' | 'easy') */
  rating: AppRating
  /** 복습이 실제로 이루어진 정확한 UTC 시각 정보 (ISO 8601 형식) */
  reviewedAt: DateTimeString
}

/**
 * 복습 완료 후 갱신/기록 결과를 전달하기 위한 응답 모델 규격입니다.
 */
export interface RateReviewResult {
  /** 다음 복습 예정 날짜와 FSRS 내부 상태 데이터가 완전히 반영되어 갱신된 ReviewItem 객체 */
  item: ReviewItem
  /** 이번 복습 처리를 기록하여 새로 발행한 이력 로깅용 ReviewLog 객체 */
  log: ReviewLog
}

/**
 * 스케줄러를 통한 복습 주기 관리 서비스를 표현하는 인터페이스 스펙입니다.
 */
export interface SchedulingService {
  /**
   * 사용자의 복습 평가 결과를 처리하고, 알고리즘을 수행하여 새 예정일을 도출한 다음,
   * 아이템을 업데이트하고 복습 로그를 기록하는 등 영속 처리를 수행합니다.
   */
  rateReview(input: RateReviewInput): RateReviewResult
}

/**
 * 스케줄링 애플리케이션 서비스를 생성하는 팩토리 함수입니다.
 *
 * 서비스 내부에서는 도메인 유효성 체크(날짜 형식 검사, 아이템 존재성 판단, 활성 상태 적격 여부 등)를
 * 철저하게 검증하고, 스케줄링 계산기에 넘기기 전에 이전 FSRS 데이터를 복제(`structuredClone`)하여
 * 혹시 모를 사이드 이펙트에 따른 데이터 오염을 격리 예방합니다.
 *
 * @param dependencies - 외부 연계 의존성 집합
 * @returns 인스턴스화가 완료된 SchedulingService 구현체
 */
export function createSchedulingService(
  dependencies: SchedulingServiceDependencies
): SchedulingService {
  const { engine, persistence, createReviewLogId } = dependencies

  return {
    rateReview({ reviewItemId, rating, reviewedAt }: RateReviewInput): RateReviewResult {
      // 1. reviewedAt 시간 정보가 표준 ISO 8601 UTC 포맷 양식과 일치하는지 철저히 점검합니다.
      const isoUtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
      if (!isoUtcRegex.test(reviewedAt) || isNaN(Date.parse(reviewedAt))) {
        throw new Error(
          'Invalid review date format. Expected ISO 8601 UTC format (e.g. YYYY-MM-DDTHH:mm:ss.sssZ)'
        )
      }

      // 2. 고유 ID를 통해 복습 항목 데이터를 인출합니다.
      const item = persistence.findReviewItemById(reviewItemId)
      if (!item) {
        throw new Error(`Review item not found: ${reviewItemId}`)
      }

      // 3. 복습 대상 아이템이 현재 활성(active) 상태인지 검증합니다. (아카이브되거나 에러 상태 항목은 복습 갱신 불가)
      if (item.status !== 'active') {
        throw new Error(`Review item is not active (status: ${item.status})`)
      }

      // 변경 이전의 원시 FSRS 상태 데이터와 스냅샷 값을 격리 확보합니다.
      const previousFsrsState = structuredClone(item.fsrsState)
      const previousDueAt = item.dueAt

      // 4. 앱 내부 문자열 평점 등급을 FSRS 전용 1~4 숫자 스케일로 치환 매핑합니다.
      const fsrsRating = mapAppRatingToFsrs(rating)

      // 5. 복습 주기를 계산해 줄 FSRS 엔진을 호출합니다.
      //    사이드 이펙트 격리를 위해 state 파라미터 전달 시 깊은 복사본을 투입합니다.
      const { dueAt: nextDueAt, state: nextFsrsState } = engine.schedule({
        state: structuredClone(previousFsrsState),
        rating: fsrsRating,
        reviewedAt
      })

      // 6. 변경된 데이터 영역이 반영된 최종 ReviewItem 도메인 객체를 생성합니다.
      const updatedItem: ReviewItem = {
        ...item,
        dueAt: nextDueAt,
        fsrsState: nextFsrsState,
        lastReviewedAt: reviewedAt,
        updatedAt: reviewedAt
      }

      // 7. 이전 스냅샷과 다음 변경 내역 정보가 포함된 안전한 트레이스 로그 레코드를 구성합니다. (SRS-FR-071)
      const log: ReviewLog = {
        id: createReviewLogId(),
        reviewItemId,
        rating,
        reviewedAt,
        previousDueAt,
        nextDueAt,
        previousFsrsState,
        nextFsrsState,
        sourceId: item.primarySourceId,
        category: item.category,
        createdAt: reviewedAt
      }

      // 8. 갱신 아이템과 복습 히스토리를 데이터베이스 영속성 트랜잭션 영역에 원자적(Atomic)으로 커밋합니다.
      persistence.recordReview(updatedItem, log)

      return {
        item: updatedItem,
        log
      }
    }
  }
}
