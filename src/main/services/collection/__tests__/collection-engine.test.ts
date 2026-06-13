import { describe, expect, it } from 'vitest'
import type { ReviewSource } from '../../../../shared/domain/source'
import type { NotionPageId } from '../../../../shared/domain/types'
import {
  CollectionError,
  createCollectionEngine,
  type CollectionPage,
  type CollectionPropertyValue
} from '../index'

function createSource(overrides: Partial<ReviewSource> = {}): ReviewSource {
  return {
    id: 'source-1' as ReviewSource['id'],
    name: 'Collection Source',
    notionTargetId: 'target-1' as ReviewSource['notionTargetId'],
    notionTargetUrl: null,
    notionTargetType: 'data_source',
    enabled: true,
    collectionMode: 'tag',
    titlePropertyName: 'Name',
    urlPropertyName: null,
    categoryPropertyName: null,
    tagPropertyName: null,
    sourcePropertyName: null,
    reviewCheckboxPropertyName: null,
    lastEditedPropertyName: null,
    filterPropertyName: 'Category',
    filterOperator: 'equals',
    filterValue: 'AI',
    lastSyncedAt: null,
    createdAt: '2026-06-13T00:00:00.000Z' as ReviewSource['createdAt'],
    updatedAt: '2026-06-13T00:00:00.000Z' as ReviewSource['updatedAt'],
    ...overrides
  }
}

function page(
  id: string,
  propertyName: string,
  property: CollectionPropertyValue | undefined
): CollectionPage {
  return {
    notionPageId: id as NotionPageId,
    properties: { [propertyName]: property }
  }
}

describe('CollectionEngine red contract', () => {
  const engine = createCollectionEngine()

  it.each([
    ['TC-COLLECTION-001', { type: 'select', value: 'AI' } as const],
    ['TC-COLLECTION-002', { type: 'status', value: 'AI' } as const],
    ['TC-COLLECTION-003', { type: 'rich_text', value: 'AI' } as const]
  ])('%s: equals accepts the exact supported value', (_id, property) => {
    const result = engine.collect({
      source: createSource(),
      pages: [
        page('match', 'Category', property),
        page('other', 'Category', { ...property, value: 'NW' })
      ]
    })

    expect(result.candidates.map(({ notionPageId }) => notionPageId)).toEqual(['match'])
  })

  it('TC-COLLECTION-004: contains matches an exact multi-select member', () => {
    const result = engine.collect({
      source: createSource({ filterOperator: 'contains', filterValue: 'review' }),
      pages: [
        page('match', 'Category', { type: 'multi_select', value: ['study', 'review'] }),
        page('other', 'Category', { type: 'multi_select', value: ['study'] })
      ]
    })

    expect(result.candidates.map(({ notionPageId }) => notionPageId)).toEqual(['match'])
  })

  it('TC-COLLECTION-005/006: contains matches rich-text substrings and excludes non-matches', () => {
    const result = engine.collect({
      source: createSource({ filterOperator: 'contains', filterValue: 'review' }),
      pages: [
        page('match', 'Category', { type: 'rich_text', value: 'needs review today' }),
        page('other', 'Category', { type: 'rich_text', value: 'completed' })
      ]
    })

    expect(result.candidates.map(({ notionPageId }) => notionPageId)).toEqual(['match'])
  })

  it.each([null, '', '   '])(
    'TC-COLLECTION-007: rejects an empty tag filter value before collection',
    (filterValue) => {
      expect(() =>
        engine.collect({
          source: createSource({ filterValue }),
          pages: []
        })
      ).toThrowError(new CollectionError('INVALID_FILTER'))
    }
  )

  it('TC-COLLECTION-008: rejects an unsupported property/operator combination', () => {
    expect(() =>
      engine.collect({
        source: createSource({ filterOperator: 'equals' }),
        pages: [page('page-1', 'Category', { type: 'multi_select', value: ['AI'] })]
      })
    ).toThrowError(new CollectionError('SCHEMA_MISMATCH'))
  })

  it('TC-COLLECTION-009: returns an empty successful result when nothing matches', () => {
    const result = engine.collect({
      source: createSource(),
      pages: [page('other', 'Category', { type: 'select', value: 'NW' })]
    })

    expect(result.candidates).toEqual([])
  })

  it('TC-COLLECTION-011/012: checkbox mode includes true and excludes false, null, and missing', () => {
    const result = engine.collect({
      source: createSource({
        collectionMode: 'checkbox',
        reviewCheckboxPropertyName: 'Review',
        filterPropertyName: null,
        filterOperator: 'checked',
        filterValue: null
      }),
      pages: [
        page('true', 'Review', { type: 'checkbox', value: true }),
        page('false', 'Review', { type: 'checkbox', value: false }),
        page('null', 'Review', { type: 'checkbox', value: null }),
        page('missing', 'Review', undefined)
      ]
    })

    expect(result.candidates.map(({ notionPageId }) => notionPageId)).toEqual(['true'])
  })

  it('TC-COLLECTION-013: rejects checkbox mode without a mapped property', () => {
    expect(() =>
      engine.collect({
        source: createSource({
          collectionMode: 'checkbox',
          reviewCheckboxPropertyName: null,
          filterPropertyName: null,
          filterOperator: 'checked',
          filterValue: null
        }),
        pages: []
      })
    ).toThrowError(new CollectionError('INVALID_FILTER'))
  })

  it.each([
    ['TC-COLLECTION-014', undefined],
    ['TC-COLLECTION-015', { type: 'rich_text', value: 'true' } as const]
  ])('%s: rejects a removed or non-checkbox mapped property', (_id, property) => {
    expect(() =>
      engine.collect({
        source: createSource({
          collectionMode: 'checkbox',
          reviewCheckboxPropertyName: 'Review',
          filterPropertyName: null,
          filterOperator: 'checked',
          filterValue: null
        }),
        pages: [page('page-1', 'Review', property)]
      })
    ).toThrowError(new CollectionError('SCHEMA_MISMATCH'))
  })

  it('TC-COLLECTION-016/017: all mode includes every page without optional mappings', () => {
    const pages = [
      page('one', 'Review', { type: 'checkbox', value: false }),
      page('two', 'Category', undefined)
    ]
    const result = engine.collect({
      source: createSource({
        collectionMode: 'all',
        filterPropertyName: null,
        filterOperator: null,
        filterValue: null,
        reviewCheckboxPropertyName: null
      }),
      pages
    })

    expect(result.candidates).toEqual(pages)
  })
})
