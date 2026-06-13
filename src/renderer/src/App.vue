<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useManualSync } from './composables/useManualSync'
import { useNotionConnection } from './composables/useNotionConnection'
import { useReviewSourceSettings } from './composables/useReviewSourceSettings'

type ReviewItem = {
  id: number
  title: string
  source: string
  category: string
  dueLabel: string
}

type AppView = 'today-review' | 'notion-integration'

const appVersion = ref('0.1.0')
const selectedId = ref(1)
const activeView = ref<AppView>('today-review')
const {
  tokenInput,
  status: notionStatus,
  state: notionState,
  message: notionMessage,
  canSave: canSaveNotionToken,
  canVerify: canVerifyNotionConnection,
  canDelete: canDeleteNotionToken,
  isBusy: isNotionConnectionBusy,
  loadStatus: loadNotionStatus,
  save: saveNotionToken,
  verify: verifyNotionConnection,
  deleteToken: deleteNotionToken
} = useNotionConnection(window.notionConnection)
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
const {
  sources: reviewSources,
  form: sourceForm,
  state: sourceState,
  message: sourceMessage,
  titleProperties,
  urlProperties,
  textLikeProperties,
  multiSelectProperties,
  checkboxProperties,
  filterProperties,
  hasProperties,
  isBusy: isSourceBusy,
  resetModeFields,
  loadSources: loadReviewSources,
  loadProperties,
  createSource,
  setEnabled: setSourceEnabled
} = useReviewSourceSettings({
  reviewSource: window.reviewSource,
  notionMetadata: window.notionMetadata,
  onSourcesChanged: loadSources
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

const confirmDeleteNotionToken = (): boolean => window.confirm('저장된 Notion 토큰을 삭제할까요?')

onMounted(async () => {
  subscribeSyncProgress()
  const [version] = await Promise.all([
    window.electronAPI.getAppVersion(),
    loadSources(),
    loadReviewSources(),
    loadNotionStatus()
  ])
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
        <button
          class="nav-item"
          :class="{ active: activeView === 'today-review' }"
          @click="activeView = 'today-review'"
        >
          <span>오늘의 복습</span>
          <b>3</b>
        </button>
        <button
          class="nav-item"
          :class="{ active: activeView === 'notion-integration' }"
          @click="activeView = 'notion-integration'"
        >
          <span>Notion 연동</span>
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
          <h1>{{ activeView === 'today-review' ? '오늘의 복습' : 'Notion 연동' }}</h1>
        </div>
        <button
          v-if="activeView === 'today-review'"
          class="sync-button"
          :disabled="isSyncRunning"
          @click="syncAll"
        >
          {{ isSyncRunning ? '동기화 중' : '전체 동기화' }}
        </button>
      </header>

      <section
        v-if="activeView === 'notion-integration'"
        class="connection-panel"
        :class="`is-${notionStatus}`"
        aria-live="polite"
      >
        <div class="connection-copy">
          <strong>Notion 연결</strong>
          <p>{{ notionMessage }}</p>
        </div>

        <form class="connection-controls" @submit.prevent="saveNotionToken">
          <input
            v-model="tokenInput"
            type="password"
            autocomplete="off"
            placeholder="Notion API key"
            aria-label="Notion API key"
            :disabled="isNotionConnectionBusy"
          />
          <button type="submit" :disabled="!canSaveNotionToken">
            {{ notionState === 'saving' ? '저장 중' : '토큰 저장' }}
          </button>
          <button
            type="button"
            class="secondary-button"
            :disabled="!canVerifyNotionConnection"
            @click="verifyNotionConnection"
          >
            {{ notionState === 'verifying' ? '검증 중' : '연결 검증' }}
          </button>
          <button
            type="button"
            class="danger-button"
            :disabled="!canDeleteNotionToken"
            @click="deleteNotionToken(confirmDeleteNotionToken)"
          >
            삭제
          </button>
        </form>
      </section>

      <section
        v-if="activeView === 'today-review'"
        class="sync-panel"
        :class="`is-${syncState}`"
        aria-live="polite"
      >
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

      <section
        v-if="activeView === 'notion-integration'"
        class="source-panel"
        :class="`is-${sourceState}`"
        aria-live="polite"
      >
        <div class="source-panel-header">
          <div>
            <strong>Review Source 등록</strong>
            <p>
              {{
                sourceMessage ||
                'Notion DB/Data Source URL 또는 ID를 입력하고 속성을 불러온 뒤 필드를 매핑합니다.'
              }}
            </p>
          </div>
          <button
            class="secondary-button"
            :disabled="isSourceBusy || !sourceForm.target.trim()"
            @click="loadProperties"
          >
            {{ sourceState === 'loading' ? '속성 조회 중' : '속성 불러오기' }}
          </button>
        </div>

        <form class="source-form" @submit.prevent="createSource">
          <label>
            Source 이름 *
            <input v-model="sourceForm.name" type="text" placeholder="예: 개발 학습" />
          </label>
          <label class="wide-field">
            Notion 대상 URL 또는 ID *
            <input
              v-model="sourceForm.target"
              type="text"
              placeholder="Notion Database/Data Source URL 또는 ID"
            />
          </label>
          <label>
            수집 방식 *
            <select v-model="sourceForm.collectionMode" @change="resetModeFields">
              <option value="all">전체 수집</option>
              <option value="tag">태그/분류 기반</option>
              <option value="checkbox">체크박스 기반</option>
            </select>
          </label>
          <label class="checkbox-field">
            <input v-model="sourceForm.enabled" type="checkbox" />
            활성 Source
          </label>

          <label>
            제목 속성 *
            <select v-model="sourceForm.titlePropertyName" :disabled="!hasProperties">
              <option value="">선택</option>
              <option v-for="property in titleProperties" :key="property.id" :value="property.name">
                {{ property.name }}
              </option>
            </select>
          </label>
          <label>
            URL 속성
            <select v-model="sourceForm.urlPropertyName" :disabled="!hasProperties">
              <option value="">Notion 페이지 URL 사용</option>
              <option v-for="property in urlProperties" :key="property.id" :value="property.name">
                {{ property.name }}
              </option>
            </select>
          </label>
          <label>
            분류 속성
            <select v-model="sourceForm.categoryPropertyName" :disabled="!hasProperties">
              <option value="">미매핑</option>
              <option
                v-for="property in textLikeProperties"
                :key="property.id"
                :value="property.name"
              >
                {{ property.name }} · {{ property.type }}
              </option>
            </select>
          </label>
          <label>
            태그 속성
            <select v-model="sourceForm.tagPropertyName" :disabled="!hasProperties">
              <option value="">미매핑</option>
              <option
                v-for="property in multiSelectProperties"
                :key="property.id"
                :value="property.name"
              >
                {{ property.name }}
              </option>
            </select>
          </label>
          <label>
            출처 속성
            <select v-model="sourceForm.sourcePropertyName" :disabled="!hasProperties">
              <option value="">미매핑</option>
              <option
                v-for="property in textLikeProperties"
                :key="property.id"
                :value="property.name"
              >
                {{ property.name }} · {{ property.type }}
              </option>
            </select>
          </label>
          <label>
            마지막 수정 속성
            <select v-model="sourceForm.lastEditedPropertyName" :disabled="!hasProperties">
              <option value="">Notion last_edited_time 사용</option>
              <option
                v-for="property in textLikeProperties"
                :key="property.id"
                :value="property.name"
              >
                {{ property.name }} · {{ property.type }}
              </option>
            </select>
          </label>

          <template v-if="sourceForm.collectionMode === 'tag'">
            <label>
              필터 속성 *
              <select v-model="sourceForm.filterPropertyName" :disabled="!hasProperties">
                <option value="">선택</option>
                <option
                  v-for="property in filterProperties"
                  :key="property.id"
                  :value="property.name"
                >
                  {{ property.name }} · {{ property.type }}
                </option>
              </select>
            </label>
            <label>
              필터 연산자 *
              <select v-model="sourceForm.filterOperator">
                <option value="equals">equals</option>
                <option value="contains">contains</option>
              </select>
            </label>
            <label>
              필터 값 *
              <input v-model="sourceForm.filterValue" type="text" placeholder="예: AI" />
            </label>
          </template>

          <label v-if="sourceForm.collectionMode === 'checkbox'">
            체크박스 속성 *
            <select v-model="sourceForm.reviewCheckboxPropertyName" :disabled="!hasProperties">
              <option value="">선택</option>
              <option
                v-for="property in checkboxProperties"
                :key="property.id"
                :value="property.name"
              >
                {{ property.name }}
              </option>
            </select>
          </label>

          <button class="source-submit" type="submit" :disabled="isSourceBusy">
            {{ sourceState === 'saving' ? '저장 중' : 'Source 저장' }}
          </button>
        </form>

        <div class="source-list">
          <div class="section-heading">
            <h2>등록된 Sources</h2>
            <span>{{ reviewSources.length }}개</span>
          </div>
          <p v-if="reviewSources.length === 0" class="empty-source">등록된 Source가 없습니다.</p>
          <button
            v-for="source in reviewSources"
            :key="source.id"
            class="source-row"
            type="button"
            @click="setSourceEnabled(source.id, !source.enabled)"
          >
            <span>
              <strong>{{ source.name }}</strong>
              <small>{{ source.collectionMode }} · {{ source.titlePropertyName }}</small>
            </span>
            <b :class="{ disabled: !source.enabled }">{{ source.enabled ? '활성' : '비활성' }}</b>
          </button>
        </div>
      </section>

      <section v-if="activeView === 'today-review'" class="summary-grid">
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

      <section v-if="activeView === 'today-review'" class="content-grid">
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
