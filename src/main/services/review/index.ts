/**
 * @file today-review-service.ts
 * @description "오늘 복습" 기능(SRS-FR-050 ~ SRS-FR-054)을 위한 비즈니스 로직, 시간 경계 계산, 정렬, 필터링 및 뷰 모델 프로젝션을 구현합니다.
 *
 * 이 서비스는 사용자의 현재 로컬 날짜 기준으로 오늘까지 복습해야 하는 항목들을 추출하며,
 * 일광절약 시간제(DST) 및 시간대(TimeZone) 오프셋 변경을 완벽하게 지원합니다. 또한, 내부 데이터 구조를
 * 렌더러에 그대로 노출하지 않도록 뷰 모델(View Model)로 변환하는 프로젝션 과정을 포함하고 있습니다.
 */

import {
  ReviewItem,
  getDisplayCategory,
  getDisplayTags,
  isTodayReview,
  compareReviewItemsByDue
} from '../../../shared/domain/item'
import type { ReviewSource } from '../../../shared/domain/source'
import type { DateTimeString, ReviewItemId, ReviewSourceId } from '../../../shared/domain/types'

/**
 * 렌더러 뷰 모델에 전달할 복습 항목의 데이터 포맷을 나타내는 인터페이스입니다.
 * 데이터베이스 및 라이브러리 전용 객체 구조를 캡슐화하고 사용자용 표준 표현만을 제공합니다.
 */
export interface TodayReviewItem {
  /** 복습 항목의 고유 ID */
  id: ReviewItemId
  /** Notion 페이지 혹은 문서의 제목 */
  title: string
  /** 연동된 Notion 데이터베이스 등의 원본 소스 명칭 */
  sourceName: string
  /** 화면에 표시할 정제된 카테고리 (값이 없을 경우 '미분류'로 자동 처리됨) */
  displayCategory: string
  /** 화면에 표시할 정제된 태그 리스트 (비어있을 경우 ['미분류']로 자동 처리됨) */
  tags: string[]
  /** 항목의 출처 메타데이터 라벨 (예: '공식 문서'), 미지정 시 null */
  originLabel: string | null
  /** 복습해야 하는 예정일시 (ISO 8601 UTC 기준) */
  dueAt: DateTimeString
  /** 마지막으로 복습을 완료한 일시, 복습 기록이 전혀 없다면 null */
  lastReviewedAt: DateTimeString | null
  /** 복습 항목의 상태. 오늘 복습 큐에서는 항상 활성 상태인 'active' 값으로 한정됩니다. */
  status: 'active'
  /** Notion 문서나 페이지를 즉시 열 수 있는 웹 링크 URL */
  notionUrl: string
}

/**
 * 오늘 복습 큐에서 지원하는 분류 필터링 형태를 정의합니다.
 */
export type TodayReviewFilter =
  /** 카테고리와 태그가 모두 지정되지 않은 공백 상태인 항목들만 필터링합니다. */
  | { kind: 'unclassified' }
  /** 입력한 카테고리 명칭과 정확히 일치하는 항목들만 필터링합니다. */
  | { kind: 'category'; value: string }
  /** 지정한 태그를 포함하고 있는 항목들만 필터링합니다. */
  | { kind: 'tag'; value: string }

/** 오늘 복습 큐에서 지원하는 정렬 옵션입니다. */
export type TodayReviewSort = 'due' | 'random'

/**
 * 오늘 복습 큐 조회 API의 반환 데이터 타입입니다.
 */
export interface TodayReviewListResult {
  /** 필터링 및 정렬이 완료되고 뷰 모델로 정제된 오늘 복습 항목 리스트 */
  items: TodayReviewItem[]
  /** 오늘 남은 복습 항목이 없어 큐가 비어 있는지 여부 */
  isEmpty: boolean
  /** 큐가 비어 있는 경우의 상태 원인 코드 (예: 복습을 모두 마친 경우 'no-due-items'), 항목이 있다면 null */
  emptyReason: 'no-due-items' | null
  /** 조회 결과에 적용된 실제 정렬 방식 */
  sort: TodayReviewSort
}

/**
 * 복습 데이터를 영속성 레이어에서 안전하게 조회해오기 위한 리더 의존성 인터페이스입니다.
 */
export interface TodayReviewReader {
  /** 특정 UTC 일시 한계점 이전에 예정된 모든 복습 대기 항목들을 반환합니다. */
  findDue(through: DateTimeString): ReviewItem[]
  /** 복습 항목이 소속된 Notion 원본 연동 데이터베이스 정보를 조회합니다. */
  findSourceById(id: ReviewSourceId): ReviewSource | null
}

/**
 * 오늘 복습 서비스를 생성할 때 주입해야 하는 의존성 사양입니다.
 */
export interface TodayReviewServiceDependencies {
  /** 복습 항목 및 소스를 관리하는 저장소 리더 객체 */
  reader: TodayReviewReader
  /** 테스트 시 예측 가능하고 제어 가능한 셔플 동작을 지원하기 위한 주입용 랜덤 함수 */
  random?: () => number
}

/**
 * 오늘 복습 목록을 조회하기 위한 요청 파라미터 사양입니다.
 */
export interface TodayReviewListInput {
  /** 조회 기준점 역할을 하는 현재 UTC 일시 (ISO 8601 형식) */
  now: DateTimeString
  /** 사용자가 활성화하여 사용 중인 로컬 IANA 시간대 명칭 (예: 'Asia/Seoul') */
  timeZone: string
  /** 적용할 정렬 옵션 (지정하지 않으면 복습 예정 시간 오름차순인 'due'가 적용됨) */
  sort?: TodayReviewSort
  /** 특정 카테고리나 태그, 혹은 미분류 항목만 골라내기 위한 필터 옵션 */
  filter?: TodayReviewFilter
}

/**
 * 오늘 복습 서비스를 정의하는 인터페이스 사양입니다.
 */
export interface TodayReviewService {
  /** 지정된 시간대 및 정렬/필터 조건에 맞춰 정제된 오늘 복습 대상 목록을 조회합니다. */
  list(input: TodayReviewListInput): TodayReviewListResult
}

/**
 * 지정한 시간대(TimeZone) 기준의 로컬 연, 월, 일, 시, 분, 초 정보를 정확한 UTC Date 객체로 환산합니다.
 *
 * 이 함수는 시스템 내장 `Intl.DateTimeFormat` 포매터를 사용하여 시간대 편차(Offset)를 확인하고
 * 오차를 반복 조정하는 방식으로 작동합니다. 이를 통해 일광절약 시간제(DST) 등 오프셋의
 * 불규칙적 변동 상황에서도 정확히 대응하며 완벽한 UTC 시간대를 알아냅니다.
 *
 * @param year - 로컬 연도
 * @param month - 로컬 월 (1-12)
 * @param day - 로컬 일
 * @param hour - 로컬 시 (0-23)
 * @param minute - 로컬 분
 * @param second - 로컬 초
 * @param timeZone - 기준이 되는 IANA 시간대 명칭
 * @returns 시간대 편차가 반영되어 변환된 UTC 기준의 Date 객체
 */
function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  // 1. 임시로 제공된 연/월/일 구성 데이터를 UTC 기준 시각으로 가정하여 초기 Date를 구성합니다.
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  // 2. 지정된 로컬 시간대 형식에 맞춰 24시간 표기로 출력되도록 포매터를 설정합니다.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  })

  // 날짜 데이터의 각 세부 영역 값을 키-값 오브젝트로 파싱하는 함수입니다.
  const getParts = (date: Date) => {
    const parts = formatter.formatToParts(date)
    const res: Record<string, number> = {}
    for (const p of parts) {
      if (p.type !== 'literal') {
        res[p.type] = parseInt(p.value, 10)
      }
    }
    return res
  }

  // 3. 로컬 시간대에서 포맷해본 결과물과 최초에 목포한 구성 영역값 사이의 편차를 연산합니다.
  const guessParts = getParts(utcDate)
  const targetTime = Date.UTC(year, month - 1, day, hour, minute, second)
  
  // 시스템별로 자정을 24시로 표시하는 경우가 있으므로 이를 0시로 정규화 보정합니다.
  const normalizedGuessHour = guessParts.hour === 24 ? 0 : guessParts.hour
  const actualTimeInTz = Date.UTC(
    guessParts.year,
    guessParts.month - 1,
    guessParts.day,
    normalizedGuessHour,
    guessParts.minute,
    guessParts.second
  )

  // 4. 편차(밀리초 단위)만큼 원래 시각에서 조정한 1차 보정 시간대를 생성합니다.
  const diff = targetTime - actualTimeInTz
  const resultDate = new Date(utcDate.getTime() + diff)

  // 5. 일광절약 시간대(DST) 등 변칙적인 경계 구간을 완벽히 소화하기 위해 2차 확인 보정을 수행합니다.
  const finalParts = getParts(resultDate)
  const normalizedFinalHour = finalParts.hour === 24 ? 0 : finalParts.hour
  const finalTimeInTz = Date.UTC(
    finalParts.year,
    finalParts.month - 1,
    finalParts.day,
    normalizedFinalHour,
    finalParts.minute,
    finalParts.second
  )

  if (finalTimeInTz !== targetTime) {
    const secondDiff = targetTime - finalTimeInTz
    return new Date(resultDate.getTime() + secondDiff)
  }

  return resultDate
}

/**
 * 사용자의 오늘 로컬 날짜의 마지막 1밀리초 시점(23:59:59.999)에 해당하는 UTC 일시 정보를 얻어옵니다.
 *
 * 단순히 현재 시점(`now`)을 사용하거나 24시간 단위 상수로 단순히 연산하는 오류(DST 대응 불가)를 피하고,
 * 사용자의 특정 시간대(TimeZone)에 속한 오늘 하루의 정확한 만료 한계 일시를 찾아내는 유효성 정책(SRS-FR-050)입니다.
 *
 * @param now - 요청 기준이 되는 UTC 현재 일시
 * @param timeZone - 사용자의 로컬 시간대 명칭
 * @returns 로컬 오늘 하루 끝 시점(23:59:59.999)을 반영한 UTC ISO 8601 문자열
 * @throws {Error} 날짜 표현이 부정확하거나 설정된 시간대를 인식하지 못할 경우
 */
export function getLocalDayEndUtc(now: DateTimeString, timeZone: string): DateTimeString {
  // 날짜 및 포맷 데이터 유효성 검사
  if (isNaN(Date.parse(now))) {
    throw new Error('Invalid date')
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone })
  } catch {
    throw new Error('Invalid time zone')
  }

  // 1. 해당 시간대 기준으로 현재 날짜(연, 월, 일) 정보를 먼저 추출합니다.
  const date = new Date(now)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = formatter.formatToParts(date)
  const yearStr = parts.find((part) => part.type === 'year')?.value
  const monthStr = parts.find((part) => part.type === 'month')?.value
  const dayStr = parts.find((part) => part.type === 'day')?.value

  if (!yearStr || !monthStr || !dayStr) {
    throw new RangeError('Unable to format the local date')
  }

  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  // 2. 내일 로컬 날짜의 00시 00분 00초를 정확한 UTC 변환 타겟으로 지정합니다.
  const nextDayLocalDate = new Date(Date.UTC(year, month - 1, day + 1))
  const nextYear = nextDayLocalDate.getUTCFullYear()
  const nextMonth = nextDayLocalDate.getUTCMonth() + 1
  const nextDay = nextDayLocalDate.getUTCDate()

  // 3. 해당 시간대의 내일 로컬 자정에 딱 맞는 UTC 기준의 인스턴스를 도출합니다.
  const nextMidnightUtc = localToUtc(nextYear, nextMonth, nextDay, 0, 0, 0, timeZone)

  // 4. 내일 자정(00시 00분 00초)에서 1밀리초를 감산하여 오늘 밤의 끝자락(23:59:59.999)을 구합니다.
  const dayEndUtc = new Date(nextMidnightUtc.getTime() - 1)
  return dayEndUtc.toISOString() as DateTimeString
}

/**
 * Fisher-Yates (피셔-예이츠) 셔플 알고리즘을 사용해 전달받은 리스트를 무작위로 재정렬합니다.
 *
 * 원본 배열의 참조를 유지하고 원소를 복사해 안전하게 정렬을 처리하며,
 * 테스트 환경에서 예측 가능한 순서 검증이 가능하도록 random 모듈 함수를 주입받아 작동하도록 구성했습니다.
 *
 * @param array - 셔플할 원본 배열 리스트
 * @param random - 난수를 반환하는 함수
 * @returns 무작위로 섞인 새로운 배열
 */
function shuffle<T>(array: T[], random: () => number): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
}

/**
 * 오늘 복습 서비스 인스턴스를 생성하는 팩토리 함수입니다.
 *
 * 영속성 데이터에 접근 가능한 리더 인터페이스 및 셔플 무작위 생성 로직을 캡슐화합니다.
 *
 * @param dependencies - 필요한 주입 의존성
 * @returns 구성이 완료된 TodayReviewService 인스턴스
 */
export function createTodayReviewService(
  dependencies: TodayReviewServiceDependencies
): TodayReviewService {
  const { reader, random } = dependencies

  return {
    list({ now, timeZone, sort, filter }: TodayReviewListInput): TodayReviewListResult {
      // 1. 데이터베이스 쿼리를 질의하기 이전에 잘못된 입력 파라미터를 예방 차단합니다.
      if (isNaN(Date.parse(now))) {
        throw new Error('Invalid date')
      }
      try {
        Intl.DateTimeFormat(undefined, { timeZone })
      } catch {
        throw new Error('Invalid time zone')
      }

      // 오늘 하루의 최종 경계 UTC 일시(예: 23:59:59.999)를 도출합니다.
      const endOfDayUtc = getLocalDayEndUtc(now, timeZone)

      // 2. 저장소로부터 오늘 복습 경계 시간대 이전에 계획되어 있는 전체 데이터를 인출해 옵니다.
      const items = reader.findDue(endOfDayUtc)

      // 3. 적격성 판정 규칙 적용: 복습 로컬 예정일이 아직 미래이거나 상태 코드가 'active'가 아니라면 필터링합니다.
      const eligibleItems = items.filter((item) => isTodayReview(item, now, timeZone))

      // 4. 분류 메타데이터 기준 필터링을 가동합니다. (SRS-FR-054)
      let filteredItems = [...eligibleItems]
      if (filter) {
        if (filter.kind === 'unclassified') {
          filteredItems = filteredItems.filter((item) => {
            const isCategoryEmpty = !item.category || item.category.trim() === ''
            const isTagsEmpty =
              !item.tags ||
              item.tags.map((t) => t.trim()).filter((t) => t !== '').length === 0
            return isCategoryEmpty && isTagsEmpty
          })
        } else if (filter.kind === 'category') {
          filteredItems = filteredItems.filter((item) => item.category === filter.value)
        } else if (filter.kind === 'tag') {
          filteredItems = filteredItems.filter((item) => item.tags.includes(filter.value))
        }
      }

      // 5. 요청 옵션에 맞추어 정렬을 실시합니다. (SRS-FR-052 / SRS-FR-053)
      let sortedItems = [...filteredItems]
      const activeSort = sort || 'due'
      if (activeSort === 'random') {
        const rand = random || Math.random
        sortedItems = shuffle(sortedItems, rand)
      } else {
        // 기본값: 복습 예정일시 오름차순. 예정일이 같다면 복습 이력이 아예 없는 항목이 먼저 정렬됩니다.
        sortedItems.sort(compareReviewItemsByDue)
      }

      // 6. 도메인 원시 데이터를 화면 출력용 데이터 구조인 뷰 모델로 투영합니다. (SRS-FR-051)
      const projectedItems = sortedItems.map((item): TodayReviewItem => {
        // 복습 항목의 데이터 소스 명칭 식별
        const source = reader.findSourceById(item.primarySourceId)
        const sourceName = source ? source.name : '알 수 없는 Source'
        
        // 유실되었거나 빈 분류/태그 영역에 대해 최종 사용자용 디폴트 대체 텍스트를 부여
        const displayCategory = getDisplayCategory(item.category)
        const tags = getDisplayTags(item.tags)

        return {
          id: item.id,
          title: item.title,
          sourceName,
          displayCategory,
          tags,
          originLabel: item.originLabel,
          dueAt: item.dueAt,
          lastReviewedAt: item.lastReviewedAt,
          status: 'active',
          notionUrl: item.notionUrl
        }
      })

      const isEmpty = projectedItems.length === 0

      return {
        items: projectedItems,
        isEmpty,
        emptyReason: isEmpty ? 'no-due-items' : null,
        sort: activeSort
      }
    }
  }
}
