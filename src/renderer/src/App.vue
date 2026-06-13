<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useManualSync } from './composables/useManualSync'

type ReviewItem = {
  id: number
  title: string
  source: string
  category: string
  dueLabel: string
}

const appVersion = ref('0.1.0')
const selectedId = ref(1)
const {
  enabledSources,
  selectedSourceId,
  state: syncState,
  currentSourceName,
  result: syncResult,
  totals: syncTotals,
  message: syncMessage,
  isRunning: isSyncRunning,
  sourceName,
  failureMessage,
  subscribe: subscribeSyncProgress,
  dispose: disposeSync,
  loadSources,
  syncAll,
  syncSelected,
  cancel: cancelSync
} = useManualSync({
  manualSync: window.manualSync,
  reviewSource: window.reviewSource
})

const reviewItems: ReviewItem[] = [
  {
    id: 1,
    title: 'Electron 프로세스 모델 정리',
    source: '개발 학습',
    category: 'Electron',
    dueLabel: '오늘'
  },
  {
    id: 2,
    title: '네트워크 계층별 핵심 개념',
    source: '시험 준비',
    category: '네트워크',
    dueLabel: '오늘'
  },
  {
    id: 3,
    title: 'FSRS 스케줄링 방식',
    source: 'AI 학습',
    category: '미분류',
    dueLabel: '1일 지남'
  }
]

const selectedItem = computed(
  () => reviewItems.find((item) => item.id === selectedId.value) ?? reviewItems[0]
)

onMounted(async () => {
  subscribeSyncProgress()
  const [version] = await Promise.all([window.electronAPI.getAppVersion(), loadSources()])
  appVersion.value = version
})

onUnmounted(disposeSync)
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">N</span>
        <div>
          <strong>Review Board</strong>
          <small>Notion spaced repetition</small>
        </div>
      </div>

      <nav class="nav-list">
        <button class="nav-item active">
          <span>오늘의 복습</span>
          <b>3</b>
        </button>
        <button class="nav-item"><span>전체 큐</span></button>
        <button class="nav-item"><span>변경된 페이지</span></button>
        <button class="nav-item"><span>삭제된 페이지</span></button>
      </nav>

      <div class="sidebar-bottom">
        <button class="nav-item"><span>Review Sources</span></button>
        <button class="nav-item"><span>설정</span></button>
        <small>v{{ appVersion }}</small>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">2026년 6월 11일</p>
          <h1>오늘의 복습</h1>
        </div>
        <button class="sync-button" :disabled="isSyncRunning" @click="syncAll">
          {{ isSyncRunning ? '동기화 중' : '전체 동기화' }}
        </button>
      </header>

      <section class="sync-panel" :class="`is-${syncState}`" aria-live="polite">
        <div class="sync-controls">
          <div>
            <strong>Manual Sync</strong>
            <p>{{ syncMessage || '활성 Source 전체 또는 하나를 선택해 동기화합니다.' }}</p>
          </div>
          <div class="source-sync-controls">
            <select
              v-model="selectedSourceId"
              aria-label="동기화 Source"
              :disabled="isSyncRunning || enabledSources.length === 0"
            >
              <option v-if="enabledSources.length === 0" value="">활성 Source 없음</option>
              <option v-for="source in enabledSources" :key="source.id" :value="source.id">
                {{ source.name }}
              </option>
            </select>
            <button
              class="secondary-button"
              :disabled="isSyncRunning || !selectedSourceId"
              @click="syncSelected"
            >
              선택 Source 동기화
            </button>
            <button v-if="isSyncRunning" class="cancel-button" @click="cancelSync">
              동기화 취소
            </button>
          </div>
        </div>

        <div v-if="isSyncRunning || syncResult" class="sync-status">
          <span v-if="currentSourceName" class="current-source">
            현재 Source: {{ currentSourceName }}
          </span>
          <div v-if="syncResult" class="sync-counts">
            <span>생성 {{ syncTotals.created }}</span>
            <span>갱신 {{ syncTotals.updated }}</span>
            <span>변경 {{ syncTotals.changed }}</span>
            <span>누락 {{ syncTotals.missing }}</span>
            <span>오류 {{ syncTotals.errors }}</span>
          </div>
        </div>

        <ul v-if="syncResult" class="source-results">
          <li
            v-for="sourceResult in syncResult.sources"
            :key="sourceResult.sourceId"
            :class="`result-${sourceResult.status}`"
          >
            <strong>{{ sourceName(sourceResult.sourceId) }}</strong>
            <span v-if="sourceResult.status === 'completed'">완료</span>
            <span v-else-if="sourceResult.status === 'cancelled'">취소됨</span>
            <span v-else>{{ failureMessage(sourceResult.errorCode) }}</span>
          </li>
        </ul>
      </section>

      <section class="summary-grid">
        <article>
          <span>오늘 남은 항목</span>
          <strong>3</strong>
        </article>
        <article>
          <span>이번 주 완료</span>
          <strong>12</strong>
        </article>
        <article>
          <span>연속 복습</span>
          <strong>4일</strong>
        </article>
      </section>

      <section class="content-grid">
        <div class="review-list">
          <div class="section-heading">
            <h2>복습 큐</h2>
            <button>날짜순</button>
          </div>

          <button
            v-for="item in reviewItems"
            :key="item.id"
            class="review-card"
            :class="{ selected: selectedId === item.id }"
            @click="selectedId = item.id"
          >
            <span class="status-dot"></span>
            <span class="review-copy">
              <strong>{{ item.title }}</strong>
              <small>{{ item.source }} · {{ item.category }}</small>
            </span>
            <span class="due-label">{{ item.dueLabel }}</span>
          </button>
        </div>

        <div class="viewer">
          <div class="viewer-toolbar">
            <div>
              <span class="tag">{{ selectedItem.category }}</span>
              <h2>{{ selectedItem.title }}</h2>
            </div>
            <button>외부에서 열기</button>
          </div>

          <div class="viewer-placeholder">
            <span class="document-icon">N</span>
            <h3>Notion 문서 뷰어</h3>
            <p>Notion 연동 후 선택한 페이지가 이 영역에 표시됩니다.</p>
          </div>

          <div class="rating-bar">
            <span>얼마나 잘 기억했나요?</span>
            <div>
              <button class="again">다시</button>
              <button>어려움</button>
              <button class="good">보통</button>
              <button class="easy">쉬움</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
