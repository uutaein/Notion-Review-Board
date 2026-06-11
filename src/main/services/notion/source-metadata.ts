/**
 * @file source-metadata.ts
 * @description Notion 데이터베이스의 스키마 속성 조회, 필드 매핑 검증, 그리고 매핑 데이터 프리뷰를 처리하는 서비스입니다.
 * 한국어 JSDoc 및 주석 규칙을 준수하여 작성되었습니다. (SRS-FR-020 ~ SRS-FR-022)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeNotionTargetId } from '../source'
import type { TokenVault } from './connection'

/**
 * Notion 데이터베이스/데이터 소스의 속성 스키마 정보입니다.
 */
export interface NotionPropertyInfo {
  /** 속성 식별자 */
  id: string
  /** 속성 표시 이름 */
  name: string
  /** 속성 타입 (Notion 데이터 타입: title, url, select, multi_select, checkbox, date, last_edited_time 등) */
  type: string
}

/**
 * 매핑 유효성 검사 결과 구조체입니다.
 */
export interface MappingValidationResult {
  /** 검증 통과 여부 */
  valid: boolean
  /** 감지된 오류 설명 리스트 */
  errors: string[]
}

/**
 * 매핑 프리뷰 결과 구조체입니다.
 */
export interface MappingPreviewResult {
  /** 샘플 데이터 존재 여부 */
  hasSample: boolean
  /** 매핑 규칙을 적용해 파싱한 결과 제목 */
  title: string | null
  /** 매핑 규칙을 적용해 파싱한 결과 URL */
  url: string | null
  /** 매핑 규칙을 적용해 파싱한 결과 대분류 */
  category: string | null
  /** 매핑 규칙을 적용해 파싱한 결과 태그 배열 */
  tags: string[]
  /** 매핑 규칙을 적용해 파싱한 결과 출처 라벨 */
  originLabel: string | null
  /** 매핑 규칙을 적용해 파싱한 결과 최근 수정 시각 */
  lastEditedAt: string | null
  /** 매핑 규칙을 적용해 파싱한 결과 체크박스 값 */
  reviewCheckbox: boolean | null
}

/**
 * Notion 대상 식별 및 타입을 판단하는 리졸버 인터페이스입니다.
 */
export interface NotionTargetResolver {
  /** Notion 입력값(URL/ID)을 분석하여 고유 ID 및 타입(database, data_source)을 식별합니다. */
  resolve(
    target: string
  ): Promise<{ targetId: string; targetType: 'database' | 'data_source' | 'unknown' }>
}

/**
 * Notion 원격 메타데이터 조회를 담당하는 경량 클라이언트 인터페이스입니다.
 */
export interface NotionMetadataClient {
  /** 특정 Notion 데이터베이스의 속성 목록을 조회합니다. */
  listProperties(targetId: string): Promise<NotionPropertyInfo[]>
  /** 특정 Notion 데이터베이스에서 최근에 작성/수정된 1개의 샘플 페이지 정보를 조회합니다. */
  fetchSamplePage(targetId: string): Promise<{
    id: string
    url: string
    properties: Record<string, any>
    last_edited_time: string
  } | null>
}

/**
 * Notion 소스 메타데이터 관리 서비스 인터페이스입니다.
 */
export interface NotionSourceMetadataService {
  resolveTarget(params: {
    target: string
  }): Promise<{ targetId: string; targetType: 'database' | 'data_source' | 'unknown' }>
  listProperties(params: { target: string }): Promise<NotionPropertyInfo[]>
  validateMapping(params: {
    target: string
    collectionMode: 'tag' | 'checkbox' | 'all'
    titlePropertyName: string
    urlPropertyName?: string | null
    categoryPropertyName?: string | null
    tagPropertyName?: string | null
    sourcePropertyName?: string | null
    reviewCheckboxPropertyName?: string | null
    lastEditedPropertyName?: string | null
    filterPropertyName?: string | null
    filterOperator?: string | null
  }): Promise<MappingValidationResult>
  previewMapping(params: {
    target: string
    titlePropertyName: string
    urlPropertyName?: string | null
    categoryPropertyName?: string | null
    tagPropertyName?: string | null
    sourcePropertyName?: string | null
    reviewCheckboxPropertyName?: string | null
    lastEditedPropertyName?: string | null
  }): Promise<MappingPreviewResult>
}

/**
 * Notion 메타데이터 서비스 인스턴스를 생성하는 팩토리 함수입니다.
 */
export function createNotionSourceMetadataService(dependencies: {
  resolver: NotionTargetResolver
  client: NotionMetadataClient
  logger?: {
    info(msg: string): void
    error(msg: string): void
  }
}): NotionSourceMetadataService {
  const { resolver, client, logger } = dependencies

  /**
   * 에러 코드를 분석하여 stable한 도메인 보안 에러 메시지로 매핑하여 던집니다. (SEC-010)
   */
  function handleNotionError(err: any): never {
    const message = err?.message || ''
    const status = err && typeof err === 'object' && 'status' in err ? err.status : undefined

    if (
      message === 'UNAUTHORIZED' ||
      message === 'INVALID_TARGET' ||
      message === 'FORBIDDEN' ||
      message === 'NOT_FOUND' ||
      message === 'RATE_LIMITED' ||
      message === 'DUPLICATE_TARGET'
    ) {
      throw err
    }

    logger?.error(
      `Notion 메타데이터 요청 중 에러 발생 (HTTP 상태: ${status}): ${err.message || err}`
    )

    if (status === 401 || message.includes('401')) {
      throw new Error('UNAUTHORIZED')
    } else if (status === 403 || message.includes('403')) {
      throw new Error('FORBIDDEN')
    } else if (status === 404 || message.includes('404')) {
      throw new Error('NOT_FOUND')
    } else if (status === 429 || message.includes('429')) {
      throw new Error('RATE_LIMITED')
    }
    throw new Error('NETWORK_ERROR')
  }

  return {
    async resolveTarget({
      target
    }): Promise<{ targetId: string; targetType: 'database' | 'data_source' | 'unknown' }> {
      try {
        const targetId = normalizeNotionTargetId(target)
        if (!targetId) {
          throw new Error('INVALID_TARGET')
        }
        return await resolver.resolve(target)
      } catch (err: any) {
        if (err.message === 'INVALID_TARGET') {
          throw err
        }
        return handleNotionError(err)
      }
    },

    async listProperties({ target }): Promise<NotionPropertyInfo[]> {
      try {
        const targetId = normalizeNotionTargetId(target)
        if (!targetId) {
          throw new Error('INVALID_TARGET')
        }
        const resolved = await resolver.resolve(targetId)
        return await client.listProperties(resolved.targetId)
      } catch (err: any) {
        if (err.message === 'INVALID_TARGET') {
          throw err
        }
        return handleNotionError(err)
      }
    },

    async validateMapping(params): Promise<MappingValidationResult> {
      try {
        const properties = await this.listProperties({ target: params.target })
        const propMap = new Map<string, string>(properties.map((p) => [p.name, p.type]))
        const errors: string[] = []

        // 1. 필수 속성 존재성 및 타입 체크
        if (!params.titlePropertyName) {
          errors.push('Title property name is required')
        } else {
          const type = propMap.get(params.titlePropertyName)
          if (!type) {
            errors.push(`Property '${params.titlePropertyName}' does not exist`)
          } else if (type !== 'title') {
            errors.push(
              `Title property '${params.titlePropertyName}' must be of type 'title' (got '${type}')`
            )
          }
        }

        // 2. 선택 매핑 타입 체크
        if (params.urlPropertyName) {
          const type = propMap.get(params.urlPropertyName)
          if (!type) {
            errors.push(`Property '${params.urlPropertyName}' does not exist`)
          } else if (type !== 'url') {
            errors.push(
              `URL property '${params.urlPropertyName}' must be of type 'url' (got '${type}')`
            )
          }
        }

        if (params.categoryPropertyName) {
          const type = propMap.get(params.categoryPropertyName)
          if (!type) {
            errors.push(`Property '${params.categoryPropertyName}' does not exist`)
          } else if (!['select', 'status', 'relation', 'rich_text'].includes(type)) {
            errors.push(
              `Category property '${params.categoryPropertyName}' type '${type}' is incompatible`
            )
          }
        }

        if (params.tagPropertyName) {
          const type = propMap.get(params.tagPropertyName)
          if (!type) {
            errors.push(`Property '${params.tagPropertyName}' does not exist`)
          } else if (!['multi_select', 'relation'].includes(type)) {
            errors.push(`Tag property '${params.tagPropertyName}' type '${type}' is incompatible`)
          }
        }

        if (params.reviewCheckboxPropertyName) {
          const type = propMap.get(params.reviewCheckboxPropertyName)
          if (!type) {
            errors.push(`Property '${params.reviewCheckboxPropertyName}' does not exist`)
          } else if (type !== 'checkbox') {
            errors.push(
              `Review checkbox property '${params.reviewCheckboxPropertyName}' must be of type 'checkbox' (got '${type}')`
            )
          }
        }

        if (params.lastEditedPropertyName) {
          const type = propMap.get(params.lastEditedPropertyName)
          if (!type) {
            errors.push(`Property '${params.lastEditedPropertyName}' does not exist`)
          } else if (!['last_edited_time', 'date'].includes(type)) {
            errors.push(
              `Last edited property '${params.lastEditedPropertyName}' must be of type 'last_edited_time' or 'date'`
            )
          }
        }

        // 3. 모드별 필터 검사
        if (params.collectionMode === 'tag') {
          if (!params.filterPropertyName) {
            errors.push('Filter property is required for tag mode')
          } else {
            const type = propMap.get(params.filterPropertyName)
            if (!type) {
              errors.push(`Filter property '${params.filterPropertyName}' does not exist`)
            } else {
              // 연산자와 타입 조합성 체크
              if (params.filterOperator === 'contains') {
                if (!['multi_select', 'relation', 'rich_text', 'title'].includes(type)) {
                  errors.push(`Operator 'contains' is incompatible with property type '${type}'`)
                }
              } else if (params.filterOperator === 'equals') {
                if (
                  !['select', 'status', 'relation', 'rich_text', 'title', 'checkbox'].includes(type)
                ) {
                  errors.push(`Operator 'equals' is incompatible with property type '${type}'`)
                }
              } else {
                errors.push(`Operator '${params.filterOperator}' is not supported for tag mode`)
              }
            }
          }
        } else if (params.collectionMode === 'checkbox') {
          // 체크박스 기반은 반드시 매핑에 checkbox 프로퍼티가 있어야 함.
          if (!params.reviewCheckboxPropertyName) {
            errors.push('Review checkbox mapping is required for checkbox mode')
          }
        }

        return {
          valid: errors.length === 0,
          errors
        }
      } catch (err) {
        return handleNotionError(err)
      }
    },

    async previewMapping(params): Promise<MappingPreviewResult> {
      try {
        const targetId = normalizeNotionTargetId(params.target)
        if (!targetId) {
          throw new Error('INVALID_TARGET')
        }

        const resolved = await resolver.resolve(targetId)
        const samplePage = await client.fetchSamplePage(resolved.targetId)
        if (!samplePage) {
          return {
            hasSample: false,
            title: null,
            url: null,
            category: null,
            tags: [],
            originLabel: null,
            lastEditedAt: null,
            reviewCheckbox: null
          }
        }

        const props = samplePage.properties

        // 헬퍼: Notion Property의 복잡한 구조에서 문자열 추출
        function getPropValue(name: string | undefined | null): any {
          if (!name) return null
          const p = props[name]
          if (!p) return null

          switch (p.type) {
            case 'title':
              return p.title?.map((t: any) => t.plain_text).join('') || ''
            case 'url':
              return p.url || null
            case 'select':
              return p.select?.name || null
            case 'status':
              return p.status?.name || null
            case 'multi_select':
              return p.multi_select?.map((s: any) => s.name) || []
            case 'relation':
              return p.relation?.map((r: any) => r.id) || []
            case 'checkbox':
              return p.checkbox ?? false
            case 'date':
              return p.date?.start || null
            case 'last_edited_time':
              return p.last_edited_time || null
            case 'rich_text':
              return p.rich_text?.map((r: any) => r.plain_text).join('') || ''
            default:
              return null
          }
        }

        // 1. 제목 파싱 (필수)
        const parsedTitle = getPropValue(params.titlePropertyName) || '제목 없음'

        // 2. URL 파싱 (fallback: Notion Page URL)
        let parsedUrl = params.urlPropertyName ? getPropValue(params.urlPropertyName) : null
        if (!parsedUrl) {
          parsedUrl = samplePage.url || null
        }

        // 3. 카테고리 파싱 (fallback: '미분류')
        let parsedCategory = '미분류'
        if (params.categoryPropertyName) {
          const val = getPropValue(params.categoryPropertyName)
          if (Array.isArray(val)) {
            parsedCategory = val[0] || '미분류'
          } else if (typeof val === 'string') {
            parsedCategory = val || '미분류'
          }
        }

        // 4. 태그 파싱 (fallback: ['미분류'])
        let parsedTags: string[] = []
        if (params.tagPropertyName) {
          const val = getPropValue(params.tagPropertyName)
          if (Array.isArray(val)) {
            parsedTags = val
          } else if (typeof val === 'string') {
            parsedTags = [val]
          }
        }
        if (parsedTags.length === 0) {
          parsedTags = ['미분류']
        }

        // 5. 출처 라벨 파싱
        const parsedOrigin = params.sourcePropertyName
          ? getPropValue(params.sourcePropertyName)
          : null

        // 6. 체크박스 파싱
        const parsedCheckbox = params.reviewCheckboxPropertyName
          ? !!getPropValue(params.reviewCheckboxPropertyName)
          : null

        // 7. 최근 수정 시각 (fallback: page.last_edited_time)
        let parsedLastEdited = params.lastEditedPropertyName
          ? getPropValue(params.lastEditedPropertyName)
          : null
        if (!parsedLastEdited) {
          parsedLastEdited = samplePage.last_edited_time || null
        }

        return {
          hasSample: true,
          title: parsedTitle,
          url: parsedUrl,
          category: parsedCategory,
          tags: parsedTags,
          originLabel: parsedOrigin,
          lastEditedAt: parsedLastEdited,
          reviewCheckbox: parsedCheckbox
        }
      } catch (err) {
        return handleNotionError(err)
      }
    }
  }
}

/**
 * 실서비스 동작 환경에서 Notion URL/ID 식별 요청을 대행하는 Target Resolver 구현체입니다.
 */
export class ProductionNotionTargetResolver implements NotionTargetResolver {
  constructor(private readonly vault: TokenVault) {}

  async resolve(
    target: string
  ): Promise<{ targetId: string; targetType: 'database' | 'data_source' | 'unknown' }> {
    const targetId = normalizeNotionTargetId(target)
    if (!targetId) {
      throw new Error('INVALID_TARGET')
    }

    const token = this.vault.getToken()
    if (!token) {
      throw new Error('UNAUTHORIZED')
    }

    // 1. Data Source 조회를 우선적으로 시도합니다.
    const dsResponse = await fetch(`https://api.notion.com/v1/data_sources/${targetId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2026-03-11'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (dsResponse.ok) {
      return { targetId, targetType: 'data_source' }
    }

    // 404가 아닌 에러(401, 403, 429 등)는 fallback 없이 즉시 전파합니다.
    if (dsResponse.status !== 404) {
      throw { status: dsResponse.status, message: `Data Source API error ${dsResponse.status}` }
    }

    // 2. Data Source가 404인 경우, Database 조회를 수행합니다 (Database URL/ID 지원).
    const dbResponse = await fetch(`https://api.notion.com/v1/databases/${targetId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2026-03-11'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (dbResponse.ok) {
      const dbData = (await dbResponse.json()) as { data_sources?: { id: string }[] }
      const dsId = dbData.data_sources?.[0]?.id
      if (dsId) {
        return { targetId: normalizeNotionTargetId(dsId), targetType: 'data_source' }
      }
      throw { status: 404, message: 'No data source found in database' }
    }

    if (dbResponse.status !== 404) {
      throw { status: dbResponse.status, message: `Database API error ${dbResponse.status}` }
    }

    throw { status: 404, message: 'Notion target not found' }
  }
}

/**
 * 실서비스 동작 환경에서 Notion API를 호출하여 속성 스키마 및 샘플 페이지 데이터를 조회하는 클라이언트 구현체입니다.
 */
export class ProductionNotionMetadataClient implements NotionMetadataClient {
  constructor(private readonly vault: TokenVault) {}

  async listProperties(targetId: string): Promise<NotionPropertyInfo[]> {
    const token = this.vault.getToken()
    if (!token) {
      throw new Error('UNAUTHORIZED')
    }

    const response = await fetch(`https://api.notion.com/v1/data_sources/${targetId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2026-03-11'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw {
        status: response.status,
        message: `Data source schema fetch error ${response.status}`
      }
    }

    const data = (await response.json()) as {
      properties: Record<string, { id: string; type: string }>
    }
    const props = data.properties || {}

    return Object.entries(props).map(([name, val]) => ({
      id: val.id,
      name,
      type: val.type
    }))
  }

  async fetchSamplePage(targetId: string): Promise<{
    id: string
    url: string
    properties: Record<string, any>
    last_edited_time: string
  } | null> {
    const token = this.vault.getToken()
    if (!token) {
      throw new Error('UNAUTHORIZED')
    }

    // 데이터 소스에 속한 가장 최근 페이지를 수집하기 위해 query data source API를 1개 제한으로 호출합니다.
    const response = await fetch(`https://api.notion.com/v1/data_sources/${targetId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2026-03-11',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page_size: 1
      }),
      signal: AbortSignal.timeout(10000)
    })

    if (response.ok) {
      const data = (await response.json()) as { results: any[] }
      const result = data.results?.[0]
      if (result) {
        return {
          id: result.id,
          url: result.url,
          properties: result.properties,
          last_edited_time: result.last_edited_time
        }
      }
      return null
    }

    if (response.status !== 404) {
      throw {
        status: response.status,
        message: `Data source query error ${response.status}`
      }
    }

    // 단독 페이지(data_source)인 경우 해당 페이지 정보를 가져옵니다 (404 불일치 시에만 fallback).
    const pageResp = await fetch(`https://api.notion.com/v1/pages/${targetId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2026-03-11'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (pageResp.ok) {
      const result = (await pageResp.json()) as any
      return {
        id: result.id,
        url: result.url,
        properties: result.properties,
        last_edited_time: result.last_edited_time
      }
    }

    throw {
      status: pageResp.status,
      message: `Failed to fetch sample page ${pageResp.status}`
    }
  }
}
