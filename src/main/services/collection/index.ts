import type { ReviewSource } from '../../../shared/domain/source'
import type { NotionPageId } from '../../../shared/domain/types'

export type CollectionPropertyValue =
  | { type: 'select'; value: string | null }
  | { type: 'status'; value: string | null }
  | { type: 'multi_select'; value: string[] }
  | { type: 'rich_text'; value: string }
  | { type: 'checkbox'; value: boolean | null }

export interface CollectionPage {
  notionPageId: NotionPageId
  properties: Readonly<Record<string, CollectionPropertyValue | undefined>>
}

export type CollectionFailureCode = 'INVALID_FILTER' | 'SCHEMA_MISMATCH'

export class CollectionError extends Error {
  constructor(readonly code: CollectionFailureCode) {
    super(code)
    this.name = 'CollectionError'
  }
}

export interface CollectionResult<TPage extends CollectionPage = CollectionPage> {
  candidates: TPage[]
}

export interface CollectionEngine {
  collect<TPage extends CollectionPage>(input: {
    source: ReviewSource
    pages: readonly TPage[]
  }): CollectionResult<TPage>
}

export function createCollectionEngine(): CollectionEngine {
  return {
    collect<TPage extends CollectionPage>({
      source,
      pages
    }: {
      source: ReviewSource
      pages: readonly TPage[]
    }): CollectionResult<TPage> {
      if (source.collectionMode === 'all') {
        return { candidates: [...pages] }
      }

      if (source.collectionMode === 'checkbox') {
        const propertyName = source.reviewCheckboxPropertyName?.trim()
        if (!propertyName) {
          throw new CollectionError('INVALID_FILTER')
        }

        const mappedValues = pages
          .map((page) => page.properties[propertyName])
          .filter((value): value is CollectionPropertyValue => value !== undefined)

        if (pages.length > 0 && mappedValues.length === 0) {
          throw new CollectionError('SCHEMA_MISMATCH')
        }
        if (mappedValues.some((value) => value.type !== 'checkbox')) {
          throw new CollectionError('SCHEMA_MISMATCH')
        }

        return {
          candidates: pages.filter((page) => {
            const value = page.properties[propertyName]
            return value?.type === 'checkbox' && value.value === true
          })
        }
      }

      const propertyName = source.filterPropertyName?.trim()
      const filterValue = source.filterValue?.trim()
      const operator = source.filterOperator
      if (!propertyName || !filterValue || (operator !== 'equals' && operator !== 'contains')) {
        throw new CollectionError('INVALID_FILTER')
      }

      const mappedValues = pages
        .map((page) => page.properties[propertyName])
        .filter((value): value is CollectionPropertyValue => value !== undefined)
      if (pages.length > 0 && mappedValues.length === 0) {
        throw new CollectionError('SCHEMA_MISMATCH')
      }

      const isCompatible = (value: CollectionPropertyValue): boolean => {
        if (operator === 'equals') {
          return value.type === 'select' || value.type === 'status' || value.type === 'rich_text'
        }
        return value.type === 'multi_select' || value.type === 'rich_text'
      }
      if (mappedValues.some((value) => !isCompatible(value))) {
        throw new CollectionError('SCHEMA_MISMATCH')
      }

      return {
        candidates: pages.filter((page) => {
          const value = page.properties[propertyName]
          if (!value) return false

          if (operator === 'equals') {
            return (
              (value.type === 'select' || value.type === 'status' || value.type === 'rich_text') &&
              value.value === filterValue
            )
          }

          if (value.type === 'multi_select') {
            return value.value.includes(filterValue)
          }
          return value.type === 'rich_text' && value.value.includes(filterValue)
        })
      }
    }
  }
}
