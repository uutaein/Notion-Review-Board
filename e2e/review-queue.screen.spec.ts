import { expect, test, type Page } from '@playwright/test'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { extname, resolve, sep } from 'node:path'

const rendererOutDir = resolve(process.cwd(), 'out/renderer')
let server: Server
let appUrl: string

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
}

const sources = [
  {
    id: 'source-dev',
    name: '개발 학습',
    notionTargetId: 'target-dev',
    notionTargetUrl: null,
    notionTargetType: 'data_source',
    enabled: true,
    collectionMode: 'all',
    titlePropertyName: 'Name',
    urlPropertyName: null,
    categoryPropertyName: 'Category',
    tagPropertyName: 'Tags',
    sourcePropertyName: 'Origin',
    reviewCheckboxPropertyName: null,
    lastEditedPropertyName: null,
    filterPropertyName: null,
    filterOperator: null,
    filterValue: null,
    lastSyncedAt: '2026-06-17T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-17T00:00:00.000Z'
  },
  {
    id: 'source-ai',
    name: 'AI 학습',
    notionTargetId: 'target-ai',
    notionTargetUrl: null,
    notionTargetType: 'data_source',
    enabled: true,
    collectionMode: 'tag',
    titlePropertyName: 'Title',
    urlPropertyName: null,
    categoryPropertyName: 'Area',
    tagPropertyName: 'Tags',
    sourcePropertyName: null,
    reviewCheckboxPropertyName: null,
    lastEditedPropertyName: null,
    filterPropertyName: 'Area',
    filterOperator: 'equals',
    filterValue: 'AI',
    lastSyncedAt: '2026-06-17T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-17T00:00:00.000Z'
  }
]

const todayReviewItem = {
  id: 'review-today',
  title: '오늘 복습 문서',
  sourceId: 'source-dev',
  sourceName: '개발 학습',
  displayCategory: 'Electron',
  tags: ['desktop'],
  originLabel: '공식 문서',
  dueAt: '2026-06-16T15:00:00.000Z',
  lastReviewedAt: null,
  status: 'active' as const,
  notionUrl: 'https://www.notion.so/today-review'
}

const queueItems = [
  {
    id: 'review-today',
    title: '오늘 복습 문서',
    sourceId: 'source-dev',
    sourceName: '개발 학습',
    sourceNames: ['개발 학습'],
    displayCategory: 'Electron',
    tags: ['desktop'],
    originLabel: '공식 문서',
    dueAt: '2026-06-16T15:00:00.000Z',
    lastReviewedAt: null,
    lastSyncedAt: '2026-06-17T00:00:00.000Z',
    status: 'active' as const,
    notionUrl: 'https://www.notion.so/today-review'
  },
  {
    id: 'review-future',
    title: '미래 일정 문서',
    sourceId: 'source-ai',
    sourceName: 'AI 학습',
    sourceNames: ['AI 학습', '개발 학습'],
    displayCategory: 'AI',
    tags: ['llm', 'review'],
    originLabel: null,
    dueAt: '2026-07-01T00:00:00.000Z',
    lastReviewedAt: '2026-06-10T00:00:00.000Z',
    lastSyncedAt: '2026-06-17T00:00:00.000Z',
    status: 'active' as const,
    notionUrl: 'https://www.notion.so/future-review'
  }
]

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
    const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname
    const filePath = resolve(rendererOutDir, `.${decodeURIComponent(pathname)}`)
    const isInsideOutDir =
      filePath === rendererOutDir || filePath.startsWith(`${rendererOutDir}${sep}`)

    if (!isInsideOutDir || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404)
      response.end('Not found')
      return
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream'
    })
    createReadStream(filePath).pipe(response)
  })

  await new Promise<void>((resolveListen) => {
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Unable to start renderer test server')
  }
  appUrl = `http://127.0.0.1:${address.port}/`
})

test.afterAll(async () => {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error)
      else resolveClose()
    })
  })
})

async function installMockPreload(page: Page): Promise<void> {
  await page.addInitScript(
    ({ sources, todayReviewItem, queueItems }) => {
      const syncResult = {
        runId: 'sync-run-1',
        status: 'completed',
        totals: { created: 0, updated: 0, changed: 0, missing: 0, errors: 0 },
        sources: [
          {
            sourceId: 'source-dev',
            status: 'completed',
            counts: { created: 0, updated: 0, changed: 0, missing: 0, errors: 0 },
            errorCode: null
          }
        ]
      }

      window.electronAPI = {
        getAppVersion: async () => '0.1.0-screen',
        openExternal: async () => undefined
      }
      window.notionConnection = {
        getStatus: async () => 'connected',
        saveToken: async () => 'connected',
        deleteToken: async () => 'not_configured',
        verify: async () => 'connected'
      }
      window.reviewSource = {
        listSources: async () => sources,
        getSource: async () => sources[0],
        createSource: async () => sources[0],
        updateSource: async () => sources[0],
        getDeleteImpact: async () => ({
          soleReferencedItemCount: 0,
          sharedReferencedItemCount: 0
        }),
        deleteSource: async () => ({ success: true }),
        setEnabled: async () => sources[0]
      }
      window.notionMetadata = {
        resolveTarget: async () => ({ targetId: 'target-dev', targetType: 'data_source' }),
        listProperties: async () => [],
        validateMapping: async () => ({ valid: true, errors: [] }),
        previewMapping: async () => ({
          hasSample: false,
          title: null,
          url: null,
          category: null,
          tags: [],
          originLabel: null,
          lastEditedAt: null,
          reviewCheckbox: null
        })
      }
      window.manualSync = {
        syncAll: async () => syncResult,
        syncSource: async () => syncResult,
        cancel: async () => ({ cancelled: true }),
        onProgress: () => () => undefined
      }
      window.todayReview = {
        list: async () => ({
          items: [todayReviewItem],
          isEmpty: false,
          emptyReason: null,
          sort: 'due'
        })
      }
      window.reviewQueue = {
        list: async () => ({
          items: queueItems,
          isEmpty: false,
          emptyReason: null,
          totalCount: queueItems.length,
          sort: 'due'
        })
      }
      window.reviewRating = {
        rate: async (payload) => ({
          itemId: payload.reviewItemId,
          rating: payload.rating,
          nextDueAt: '2026-07-01T00:00:00.000Z',
          reviewedAt: '2026-06-17T00:00:00.000Z'
        })
      }
      window.reviewExclusion = {
        exclude: async (payload) => ({
          itemId: payload.reviewItemId,
          status: 'archived',
          excludedAt: '2026-06-17T00:00:00.000Z'
        })
      }
      window.statusPages = {
        list: async (payload) => ({ kind: payload.kind, items: [], isEmpty: true }),
        handleChanged: async (payload) => ({
          itemId: payload.reviewItemId,
          status: 'active',
          dueAt: '2026-06-17T00:00:00.000Z',
          handledAt: '2026-06-17T00:00:00.000Z'
        })
      }
      window.documentViewer = {
        open: async (payload) => ({ opened: true, url: payload.url }),
        openExternal: async (payload) => ({ opened: true, url: payload.url }),
        close: async () => ({ closed: true }),
        resize: async () => ({ resized: true })
      }
    },
    { sources, todayReviewItem, queueItems }
  )
}

test('full review queue screen shows active due and future items without layout overflow', async ({
  page
}) => {
  await installMockPreload(page)

  await page.goto(appUrl)
  await expect(page.getByRole('heading', { name: '오늘의 복습' })).toBeVisible()

  await page.getByRole('button', { name: /전체 큐/ }).click()

  await expect(page.getByRole('heading', { name: '전체 큐' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '전체 active 큐' })).toBeVisible()
  await expect(page.getByRole('button', { name: /오늘 복습 문서/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /미래 일정 문서/ })).toBeVisible()

  await page.getByRole('button', { name: /미래 일정 문서/ }).click()

  await expect(page.getByRole('heading', { name: '미래 일정 문서' })).toBeVisible()
  await expect(page.getByText('AI 학습, 개발 학습')).toBeVisible()
  await expect(page.getByText('2026-07-01T00:00:00.000Z')).toBeVisible()
  await expect(page.getByText('https://www.notion.so/future-review')).toBeVisible()
  await expect(page.getByText('changed')).toHaveCount(0)
  await expect(page.getByText('archived')).toHaveCount(0)

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(hasHorizontalOverflow).toBe(false)

  const screenshot = await page.screenshot({
    path: 'test-results/playwright/review-queue-screen.png',
    fullPage: true
  })
  expect(screenshot.length).toBeGreaterThan(10_000)
})
