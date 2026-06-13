# ADR Log — Notion Review Board

| 항목 | 내용 |
| --- | --- |
| 문서 종류 | ADR (Architecture Decision Record) |
| 제품명 | Notion Review Board |
| 버전 | v0.1-draft |
| 상태 | PRD v0.1 및 SRS v0.1-draft 기반 초안 |
| 작성일 | 2026-06-11 |
| 시간대 기준 | Asia/Seoul |
| 범위 | MVP 아키텍처 결정 |
| 기준 문서 | `PRD-v0.1.md`, `SRS — Notion Review Board` |

---

## ADR 목록

| ADR | 제목 | 상태 |
| --- | --- | --- |
| ADR-001 | Electron 기반 로컬 데스크톱 앱을 MVP 런타임으로 선택 | Accepted |
| ADR-002 | 로컬 SQLite를 단일 영속 저장소로 사용 | Accepted |
| ADR-003 | Notion API는 Data Source 모델을 우선 지원하고 Database 입력은 호환 계층에서 처리 | Accepted |
| ADR-004 | Source별 수동 필드 매핑을 MVP 기본 전략으로 선택 | Accepted |
| ADR-005 | Review Item의 1차 식별자는 Notion Page ID로 고정 | Accepted |
| ADR-006 | FSRS 스케줄링은 `ts-fsrs` 계열 TypeScript 라이브러리로 캡슐화 | Proposed |
| ADR-007 | Notion 토큰은 Electron safeStorage 기반 로컬 암호화 저장을 우선 | Proposed |
| ADR-008 | Notion 페이지 열람은 WebContentsView 또는 동등한 격리 뷰를 사용하고 `<webview>`는 피함 | Accepted |
| ADR-009 | 동기화는 수동 실행을 MVP 기본값으로 선택 | Accepted |
| ADR-010 | 삭제와 누락은 missing → deleted 상태 전이를 통해 보수적으로 처리 | Accepted |
| ADR-011 | 변경된 페이지는 자동 일정 변경 없이 사용자 선택으로 처리 | Accepted |
| ADR-012 | 복습 평가는 버튼 기반 4단계 평가를 필수 UX로 채택 | Accepted |
| ADR-013 | Notion 페이지 본문 전체를 저장하지 않는 메타데이터 저장 정책 채택 | Accepted |
| ADR-014 | Main Process 중심의 Notion/SQLite/보안 경계 유지 | Accepted |
| ADR-015 | Review Source 식별과 삭제 정책을 명시적으로 고정 | Accepted |

---

## ADR-001 — Electron 기반 로컬 데스크톱 앱을 MVP 런타임으로 선택

### 상태

Accepted

### 맥락

PRD는 1차 제품을 Electron 데스크톱 앱으로 정의한다. 사용자는 Notion 문서를 로컬 PC에서 복습하고, iPad 사용은 네이티브 앱이 아니라 원격 데스크톱 조작 시나리오로 고려한다.

대안:

1. Electron 데스크톱 앱
2. 웹 SaaS
3. 네이티브 Windows 앱
4. iPad 네이티브 앱
5. PWA 또는 Capacitor 기반 앱

### 결정

MVP는 Electron 데스크톱 앱으로 구현한다. Windows를 1차 지원 플랫폼으로 두고, macOS/Linux는 구조상 막지 않되 MVP 검증 범위에서는 후순위로 둔다.

### 근거

1. PRD의 실행 형태와 운영 환경이 Electron Desktop으로 확정되어 있다.
2. 로컬 SQLite, OS 보안 저장소, 외부 브라우저 열기, 내부 문서 뷰어가 모두 데스크톱 앱과 잘 맞는다.
3. 웹 SaaS를 선택하면 사용자 데이터와 토큰을 서버로 보내야 하므로 MVP의 로컬 우선 방향과 맞지 않는다.
4. 네이티브 Windows 앱은 Windows 최적화에는 유리하지만, TypeScript 기반 Notion/FSRS 라이브러리 재사용성이 낮아진다.
5. iPad 네이티브 앱은 PRD의 명시적 Non-Goal이다.

### 결과

긍정적 결과:

1. Notion API, FSRS, SQLite, UI를 TypeScript 중심으로 연결할 수 있다.
2. 로컬 파일과 OS 통합 기능을 사용할 수 있다.
3. MVP를 빠르게 만들 수 있다.

부정적 결과:

1. Electron 보안 설정을 엄격히 관리해야 한다.
2. 앱 크기와 메모리 사용량이 네이티브 앱보다 커질 수 있다.
3. 패키징과 native module rebuild 문제가 발생할 수 있다.

### 후속 조치

1. Electron 보안 체크리스트를 구현 기준으로 둔다.
2. Windows 패키징 방식을 SDD에서 확정한다.
3. native dependency가 필요한 SQLite 드라이버는 패키징 검증을 초기에 수행한다.

---

## ADR-002 — 로컬 SQLite를 단일 영속 저장소로 사용

### 상태

Accepted

### 맥락

앱은 Review Source, Review Item, FSRS 상태, Review Log, Sync Event를 로컬에 저장해야 한다. PRD는 SQLite 저장을 명시한다.

대안:

1. SQLite
2. IndexedDB
3. JSON 파일
4. DuckDB
5. 서버 DB

### 결정

MVP의 영속 저장소는 로컬 SQLite로 한다. DB 파일은 Electron 앱의 user data 영역에 저장하고, schema migration을 관리한다.

Node.js 접근 라이브러리는 `better-sqlite3`를 우선 후보로 둔다. 최종 선택은 패키징 검증과 migration 전략을 SDD에서 확인한 뒤 확정한다.

### 근거

1. PRD가 SQLite를 명시한다.
2. Review Queue와 Today Review는 `dueAt`, `status`, `notionPageId` 기반 조회가 많아 관계형 DB와 잘 맞는다.
3. Review Log와 Sync Event를 장기 보존해야 하므로 JSON 파일보다 migration과 인덱스 관리가 중요하다.
4. `better-sqlite3`는 Node.js에서 SQLite를 단순한 동기 API와 트랜잭션으로 다룰 수 있고, WAL 사용도 권장한다.
5. 개인 로컬 앱 규모에서는 서버 DB가 과하다.

### 결과

긍정적 결과:

1. 로컬 우선 구조를 유지한다.
2. 복습 평가를 트랜잭션으로 저장하기 쉽다.
3. 통계 기능으로 확장하기 쉽다.
4. 백업/복원 기능으로 확장 가능하다.

부정적 결과:

1. native module 패키징과 rebuild 이슈를 확인해야 한다.
2. 장시간 동기화나 대량 쿼리가 Main Process event loop를 막지 않도록 설계해야 한다.
3. schema migration 실패 처리 UX가 필요하다.

### 후속 조치

1. SDD에서 DB 파일 위치와 migration 테이블을 정의한다.
2. `review_items(notion_page_id)` unique index를 둔다.
3. `review_items(status, due_at)` index를 둔다.
4. 평가 저장은 Review Item + Review Log를 하나의 transaction으로 처리한다.
5. 대량 동기화 성능 문제가 확인되면 worker thread 또는 batch 처리로 확장한다.

---

## ADR-003 — Notion API는 Data Source 모델을 우선 지원하고 Database 입력은 호환 계층에서 처리

### 상태

Accepted

### 맥락

PRD는 사용자가 Notion 데이터베이스 URL 또는 ID를 등록한다고 표현한다. 그러나 Notion API는 최근 Database와 Data Source 개념을 분리했고, 신규 API에서는 Data Source Query를 사용한다.

대안:

1. 기존 Database Query API만 사용
2. 신규 Data Source API만 사용
3. 입력은 Database/URL을 허용하되 내부에서 Data Source 중심으로 정규화
4. Notion API 버전을 고정하지 않고 SDK 기본값에 의존

### 결정

MVP의 사용자 언어는 PRD와 같이 “Notion 데이터베이스”를 유지한다. 내부 연동 계층은 Notion Target을 `database`, `data_source`, `unknown`으로 정규화하고, 신규 Data Source Query API를 우선 사용한다. 기존 Database Query API는 호환 경로로만 유지한다.

API 버전은 SDD에서 명시적으로 고정한다. 현재 문서 기준 최신 Notion-Version은 `2026-03-11`로 확인되며, SDK 또는 API 호출도 이 버전 호환성을 기준으로 검증한다.

### 근거

1. 사용자는 Notion UI에서 여전히 데이터베이스로 인식한다.
2. Notion 공식 문서에서 기존 Database Query 문서는 `2025-09-03` 이후 개념 분리를 안내하고 Data Source Query를 새 경로로 제시한다.
3. PRD의 Database 중심 용어를 구현 내부에 그대로 고정하면 API 변화에 취약하다.
4. 명시적 API 버전을 사용해야 추후 Notion API 변경의 영향을 통제할 수 있다.

### 결과

긍정적 결과:

1. 사용자 UX는 단순하게 유지된다.
2. 신규 Notion API 모델에 대응할 수 있다.
3. 기존 PRD 요구와 최신 API 구조 사이의 충돌을 줄인다.

부정적 결과:

1. URL/ID 해석 로직이 필요하다.
2. Database ID와 Data Source ID 간 변환 또는 발견 과정이 필요할 수 있다.
3. Notion API 버전별 응답 차이를 테스트해야 한다.

### 후속 조치

1. SDD에서 Notion Target Resolver를 정의한다.
2. URL 입력 예시별 파싱 테스트를 만든다.
3. Data Source Query를 기본 경로로 검증한다.
4. Database Query fallback 필요 여부를 실제 Notion 테스트로 확정한다.

---

## ADR-004 — Source별 수동 필드 매핑을 MVP 기본 전략으로 선택

### 상태

Accepted

### 맥락

Notion 데이터베이스마다 제목, 분류, 태그, 체크박스, 출처 속성명이 다를 수 있다. 자동 추론은 편리하지만 오탐 위험이 있다.

대안:

1. 모든 필드를 자동 추론
2. Source별 수동 매핑
3. 자동 추천 + 사용자 확인
4. 고정 속성명 convention 요구

### 결정

MVP는 Source별 수동 필드 매핑을 기본 전략으로 한다. 자동 추천은 있더라도 보조 기능이며, 사용자가 최종 매핑을 확인해야 한다.

### 근거

1. PRD가 Source별 필드 매핑을 핵심 범위로 명시한다.
2. Notion DB 구조 다양성이 제품의 핵심 리스크다.
3. 자동 추론 오탐은 잘못된 복습 큐 생성으로 이어질 수 있다.
4. 수동 매핑은 구현이 작고 예측 가능하다.

### 결과

긍정적 결과:

1. 데이터 구조가 달라도 대응 가능하다.
2. 동기화 결과를 사용자가 이해하기 쉽다.
3. MVP 구현 범위를 줄인다.

부정적 결과:

1. 초기 설정 단계가 길어진다.
2. 사용자가 Notion 속성 타입을 이해해야 할 수 있다.

### 후속 조치

1. Source 저장 전 수집 테스트를 제공한다.
2. 필수/선택/조건부 필드를 UI에서 명확히 구분한다.
3. P1에서 자동 추천을 검토한다.

---

## ADR-005 — Review Item의 1차 식별자는 Notion Page ID로 고정

### 상태

Accepted

### 맥락

여러 Notion Source에서 같은 페이지가 발견될 수 있다. 제목이나 URL만으로 병합하면 오탐 가능성이 있다.

대안:

1. 제목 기준 병합
2. URL 기준 병합
3. Notion Page ID 기준 병합
4. Source ID + 제목 기준 병합

### 결정

Review Item의 1차 식별자는 Notion Page ID로 한다. 같은 Page ID는 하나의 Review Item으로 병합하고, 여러 Source 참조는 `sourceIds`로 보존한다.

URL이 같지만 Page ID가 다른 항목은 자동 병합하지 않고 중복 후보로만 다룬다. 제목만 같은 항목은 중복으로 보지 않는다.

### 근거

1. PRD가 Notion Page ID를 중복 판단의 1차 기준으로 명시한다.
2. 제목은 변경될 수 있고 중복될 수 있다.
3. URL은 공유/리다이렉트/복사 과정에서 예외가 생길 수 있다.
4. Notion Page ID는 API 객체의 안정적인 식별자다.

### 결과

긍정적 결과:

1. 중복 생성 위험이 낮다.
2. Source 병합 규칙이 명확하다.
3. Review Log가 안정적으로 누적된다.

부정적 결과:

1. URL만 같은 별도 Page ID는 자동 정리되지 않는다.
2. 중복 후보 화면은 P1에서 필요할 수 있다.

### 후속 조치

1. `notionPageId` unique index를 둔다.
2. `sourceIds` 또는 join table을 설계한다.
3. URL 중복 후보 감지는 P1 후보로 둔다.

---

## ADR-006 — FSRS 스케줄링은 `ts-fsrs` 계열 TypeScript 라이브러리로 캡슐화

### 상태

Proposed

### 맥락

PRD는 복습 평가를 FSRS의 Again/Hard/Good/Easy에 매핑하고, 평가 후 다음 복습일을 계산해야 한다고 정의한다.

대안:

1. FSRS 알고리즘 직접 구현
2. `ts-fsrs` 사용
3. 다른 언어 FSRS 구현을 별도 프로세스로 호출
4. 단순 SM-2 알고리즘 사용

### 결정

MVP는 TypeScript 생태계의 `ts-fsrs` 계열 라이브러리를 우선 후보로 사용한다. 다만 앱 내부에는 `SchedulingService` 같은 얇은 래퍼를 두어 라이브러리 상태 구조가 UI와 DB 전체에 직접 퍼지지 않게 한다.

### 근거

1. 앱은 Electron/TypeScript 중심으로 구현될 가능성이 높다.
2. `ts-fsrs`는 TypeScript 기반 FSRS 툴킷이며 Node.js 20 이상을 요구한다.
3. 직접 구현은 알고리즘 오류와 검증 부담이 크다.
4. SM-2는 PRD의 FSRS 명시 요구와 맞지 않는다.

### 결과

긍정적 결과:

1. 검증된 구현을 재사용할 수 있다.
2. 4단계 평가 매핑을 명확히 유지할 수 있다.
3. 추후 파라미터 최적화로 확장 가능하다.

부정적 결과:

1. 라이브러리 버전과 상태 직렬화 형식 변화에 영향을 받을 수 있다.
2. Node.js 20 이상 요구가 Electron 버전 선택에 영향을 줄 수 있다.
3. 라이브러리 API 변경에 대비한 래퍼와 테스트가 필요하다.

### 후속 조치

1. SDD에서 `fsrsState` JSON 구조와 `fsrsStateVersion`을 정의한다.
2. Again/Hard/Good/Easy 매핑 단위 테스트를 만든다.
3. 라이브러리 업그레이드 시 회귀 테스트용 fixture를 유지한다.
4. Electron에 포함되는 Node.js 버전이 요구 조건을 만족하는지 확인한다.

---

## ADR-007 — Notion 토큰은 Electron safeStorage 기반 로컬 암호화 저장을 우선

### 상태

Proposed

### 맥락

PRD는 Notion API 토큰 저장 방식을 미확정으로 둔다. 후보는 로컬 설정 파일, OS 보안 저장소, 환경 변수다. MVP는 Windows 우선 데스크톱 앱이므로 사용자가 매번 토큰을 입력하지 않으면서도 평문 저장을 피해야 한다.

대안:

1. 로컬 설정 파일에 평문 저장
2. 환경 변수만 지원
3. Electron safeStorage 사용
4. keytar 같은 별도 네이티브 keychain 라이브러리 사용
5. 토큰을 저장하지 않고 매 실행마다 입력

### 결정

MVP는 Electron `safeStorage`의 async API를 우선 사용해 Notion 토큰을 암호화한 뒤 앱 user data 영역에 저장한다.

Windows 우선 범위에서는 DPAPI 기반 보호를 기대한다. macOS/Linux 확장 시에는 Keychain/secret store 동작을 별도로 검증한다. Linux에서 `basic_text` 같은 취약 backend가 감지되면 저장을 비활성화하거나 사용자에게 명시적으로 경고한다.

### 근거

1. Electron safeStorage는 OS 제공 암호화 시스템을 사용해 로컬 문자열 암복호화를 제공한다.
2. 공식 문서는 async API가 non-blocking이고 key rotation과 temporary unavailability 처리에 유리하다고 권장한다.
3. 평문 설정 파일은 토큰 유출 위험이 높다.
4. 환경 변수만 지원하면 일반 사용자 UX가 나쁘다.
5. 별도 keychain 라이브러리는 native packaging 부담을 늘린다.

### 결과

긍정적 결과:

1. 토큰 저장 UX와 보안의 균형을 맞춘다.
2. Electron 내장 기능을 우선 사용해 dependency를 줄인다.
3. Windows 우선 MVP와 잘 맞는다.

부정적 결과:

1. 같은 사용자 공간의 악성 앱으로부터 완전한 보호를 보장하지 않는다.
2. Linux 환경에서는 secret store에 따라 보호 수준이 달라진다.
3. safeStorage 사용 가능 여부에 따른 fallback UX가 필요하다.

### 후속 조치

1. 토큰 원문은 메모리와 로그에 최소 노출한다.
2. encrypted token blob만 저장한다.
3. `isEncryptionAvailable`와 selected backend 확인 로직을 둔다.
4. 토큰 삭제 기능을 제공한다.
5. secret-safe logging 정책을 테스트한다.

---

## ADR-008 — Notion 페이지 열람은 WebContentsView 또는 동등한 격리 뷰를 사용하고 `<webview>`는 피함

### 상태

Accepted

### 맥락

PRD는 Electron 내부 뷰어에서 Notion Page URL을 열고 실패 시 외부 브라우저 fallback을 제공한다고 정의한다. Electron에서 원격 웹 콘텐츠를 로드하는 것은 보안 위험이 크다.

대안:

1. `<webview>` 태그
2. iframe
3. WebContentsView
4. 내부 뷰어 없이 항상 외부 브라우저 열기
5. Notion 페이지 본문을 API로 가져와 자체 렌더링

### 결정

MVP는 `<webview>` 태그 사용을 피하고, Electron의 WebContentsView 또는 동등한 격리 뷰를 우선 검토한다. 내부 뷰어는 Node.js integration을 끄고, context isolation과 sandbox를 적용한다. 내부 열람이 실패하면 외부 브라우저 열기를 제공한다.

Notion 페이지 본문을 앱 DB에 저장하거나 자체 렌더링하는 방식은 MVP에서 사용하지 않는다.

### 근거

1. Electron 공식 문서는 `<webview>` 태그 사용을 권장하지 않고 WebContentsView 같은 대안을 제시한다.
2. Electron 보안 문서는 원격 콘텐츠에 Node.js integration을 활성화하지 말라고 권고한다.
3. PRD는 Notion 페이지 본문 전체 미저장을 명시한다.
4. 외부 브라우저 fallback은 로그인/권한/보안 정책 문제에 대응할 수 있다.

### 결과

긍정적 결과:

1. 내부 뷰어 보안 위험을 줄인다.
2. Notion 페이지 본문 저장을 피한다.
3. 실패 시 사용자가 외부 브라우저로 계속 복습할 수 있다.

부정적 결과:

1. 내부 뷰어 레이아웃과 세션 관리를 직접 구현해야 한다.
2. Notion 로그인/권한 상태에 따라 내부 열람이 불안정할 수 있다.
3. WebContentsView 사용성 검증이 필요하다.

### 후속 조치

1. URL allowlist를 정의한다.
2. `shell.openExternal` 호출 전 URL을 검증한다.
3. 새 창 생성과 navigation을 제한한다.
4. 내부 뷰어 실패 이벤트를 사용자 친화적으로 표시한다.

---

## ADR-009 — 동기화는 수동 실행을 MVP 기본값으로 선택

### 상태

Accepted

### 맥락

PRD는 MVP에서 수동 동기화를 기본으로 하고 자동 동기화는 후속 버전으로 둔다.

대안:

1. 수동 동기화만 제공
2. 앱 시작 시 자동 동기화
3. 주기적 자동 동기화
4. Notion webhook 기반 동기화

### 결정

MVP는 수동 동기화를 기본값으로 한다. 사용자는 전체 활성 Source 또는 단일 Source를 명시적으로 동기화할 수 있다.

### 근거

1. PRD가 수동 동기화를 MVP 기본으로 명시한다.
2. 자동 동기화는 rate limit, 충돌, 배터리, UX, 오류 알림 정책이 추가로 필요하다.
3. 로컬 개인 앱에서는 사용자가 동기화 시점을 명확히 통제하는 편이 안전하다.
4. 삭제/변경 감지 정책이 확정되기 전 자동 동기화는 예기치 않은 상태 변화를 만들 수 있다.

### 결과

긍정적 결과:

1. MVP 구현 범위가 줄어든다.
2. Notion API 사용량을 통제하기 쉽다.
3. 오류 발생 시 사용자가 동기화 맥락을 이해하기 쉽다.

부정적 결과:

1. 사용자가 동기화를 잊으면 최신 상태가 반영되지 않는다.
2. 오늘 복습 목록이 Notion 변경을 즉시 반영하지 못한다.

### 후속 조치

1. 마지막 동기화 시각을 화면에 표시한다.
2. 동기화 필요 안내를 제공한다.
3. P1에서 자동 동기화 주기와 백그라운드 방식 검토를 남긴다.

---

## ADR-010 — 삭제와 누락은 missing → deleted 상태 전이를 통해 보수적으로 처리

### 상태

Accepted

### 맥락

동기화 결과에서 기존 페이지가 사라졌다고 해서 실제 삭제라고 단정할 수 없다. 권한 오류, Integration 공유 해제, 필터 조건 변경, 네트워크/API 오류도 원인이 될 수 있다.

대안:

1. 조회 결과에서 누락되면 즉시 삭제
2. 누락되면 missing으로 표시하고 재확인 후 deleted 확정
3. 삭제를 자동 처리하지 않고 항상 사용자 수동 처리
4. 삭제 상태를 전혀 관리하지 않음

### 결정

MVP는 누락 항목을 즉시 deleted로 확정하지 않는다. 먼저 `missing` 또는 삭제 후보로 표시하고, Page ID 재확인 또는 후속 동기화 결과를 통해 `deleted`로 전환한다.

deleted 항목은 Today Review에서 제외하되 Review Log는 기본 보존한다.

### 근거

1. PRD가 삭제와 동기화 오류 혼동을 주요 리스크로 정의한다.
2. Notion 권한 부족과 대상 없음 응답은 실제 삭제와 구분이 어려울 수 있다.
3. 즉시 삭제는 사용자의 복습 기록 손실로 이어질 수 있다.
4. 보수적 상태 전이는 로컬 데이터 보호에 유리하다.

### 결과

긍정적 결과:

1. 일시적 오류로 인한 데이터 손실을 줄인다.
2. 사용자가 삭제 후보를 직접 검토할 수 있다.
3. Review Log 보존 정책과 잘 맞는다.

부정적 결과:

1. 상태 모델이 복잡해진다.
2. 삭제 후보 화면과 재확인 로직이 필요하다.
3. deleted 확정 기준을 추가로 정해야 한다.

### 후속 조치

1. missingDetectedAt과 deletedDetectedAt을 저장한다.
2. 다시 확인 액션을 제공한다.
3. SDD에서 삭제 확정 기준을 정의한다.
4. 삭제 후보 무시 또는 기록 보존 처리를 설계한다.

---

## ADR-011 — 변경된 페이지는 자동 일정 변경 없이 사용자 선택으로 처리

### 상태

Accepted

### 맥락

Notion 페이지의 수정 시각이 바뀌어도 실제 학습 내용이 의미 있게 바뀐 것은 아닐 수 있다. PRD는 변경된 페이지를 자동으로 오늘 복습으로 당기지 않고 사용자가 선택하도록 정의한다.

대안:

1. 변경 감지 즉시 dueAt을 오늘로 변경
2. 변경 감지 후 사용자에게 선택권 제공
3. 변경 감지를 무시
4. 변경 감지 후 FSRS 상태를 자동 리셋

### 결정

MVP는 변경된 페이지를 별도 화면에 표시하고, 사용자가 `오늘 복습으로 당기기` 또는 `기존 일정 유지`를 선택하게 한다.

### 근거

1. PRD가 사용자 선택을 명시한다.
2. 모든 수정이 복습 필요 변경은 아니다.
3. FSRS 상태 자동 리셋은 사용자의 기존 학습 이력을 왜곡할 수 있다.
4. 사용자가 문맥을 가장 잘 판단할 수 있다.

### 결과

긍정적 결과:

1. 불필요한 복습 일정 변경을 막는다.
2. 사용자가 변경 페이지를 통제할 수 있다.
3. FSRS 기록의 안정성이 유지된다.

부정적 결과:

1. 사용자가 변경 화면을 관리해야 한다.
2. 변경 항목이 쌓일 수 있다.

### 후속 조치

1. 변경 화면에 일괄 처리 기능을 P1 후보로 둔다.
2. 변경 처리 이력을 Sync Event에 기록한다.
3. 변경 감지 기준을 SDD에서 더 구체화한다.

---

## ADR-012 — 복습 평가는 버튼 기반 4단계 평가를 필수 UX로 채택

### 상태

Accepted

### 맥락

PRD는 다시/어려움/보통/쉬움의 4단계 평가를 FSRS Again/Hard/Good/Easy에 매핑한다. 칸반 드래그는 P1 후보 또는 보조 기능이며, iPad 원격 데스크톱 사용에서는 드래그가 불편할 수 있다.

대안:

1. 버튼 기반 평가
2. 칸반 드래그 기반 평가
3. 키보드 단축키만 제공
4. 자동 평가

### 결정

MVP는 버튼 기반 4단계 평가를 필수 UX로 채택한다. 칸반 드래그가 구현되더라도 버튼 평가는 유지한다.

### 근거

1. PRD가 난이도 평가 버튼을 반드시 제공해야 한다고 명시한다.
2. 원격 데스크톱/터치 환경에서 버튼이 드래그보다 안정적이다.
3. FSRS 평가 매핑이 4단계라 버튼 모델과 잘 맞는다.
4. 버튼 이벤트는 테스트와 접근성 측면에서 단순하다.

### 결과

긍정적 결과:

1. MVP 구현이 단순하다.
2. iPad 원격 사용 시나리오와 맞다.
3. 평가 저장 트랜잭션을 명확히 연결할 수 있다.

부정적 결과:

1. 칸반 중심의 시각적 워크플로우는 후순위가 된다.
2. 실수 평가 취소 UX는 별도로 검토해야 한다.

### 후속 조치

1. 버튼 크기와 위치를 UI 설계에 반영한다.
2. P1에서 평가 되돌리기를 검토한다.
3. 키보드 단축키는 접근성 보조 기능으로 검토한다.

---

## ADR-013 — Notion 페이지 본문 전체를 저장하지 않는 메타데이터 저장 정책 채택

### 상태

Accepted

### 맥락

제품 목표는 Notion 문서를 복제하는 것이 아니라 문서 URL 단위의 복습 큐를 관리하는 것이다. PRD는 Notion 페이지 본문 전체 미저장을 반복해서 명시한다.

대안:

1. 본문 전체 저장
2. 제목과 메타데이터만 저장
3. 본문 일부 요약 저장
4. 검색 인덱스만 저장

### 결정

MVP는 제목, URL, Page ID, 분류/태그, 출처, Notion 수정 시각, FSRS 상태, Review Log, Sync Event만 저장한다. Notion 페이지 본문 전체, 블록 내용, OCR/PDF 내용은 저장하지 않는다.

### 근거

1. PRD의 본문 미저장 정책과 Non-Goal을 따른다.
2. 저장 데이터 최소화와 개인정보 보호에 유리하다.
3. Notion이 원본 문서 저장소 역할을 유지한다.
4. 본문 저장은 동기화, 권한, 충돌, 검색 인덱싱 범위를 크게 넓힌다.

### 결과

긍정적 결과:

1. 데이터 저장 범위가 작다.
2. 구현과 보안 범위가 줄어든다.
3. Notion 문서 편집/복제 문제를 피한다.

부정적 결과:

1. 오프라인 본문 열람은 제공하지 못한다.
2. 앱 내 전문 검색이나 AI 요약은 MVP에서 불가능하다.
3. Notion 권한/로그인 문제가 있으면 문서 열람이 제한된다.

### 후속 조치

1. 데이터 모델에 본문 필드를 만들지 않는다.
2. Notion block children API를 MVP 동기화에서 호출하지 않는다.
3. P2에서 검색/AI 기능을 검토할 때 별도 ADR을 작성한다.

---

## ADR-014 — Main Process 중심의 Notion/SQLite/보안 경계 유지

### 상태

Accepted

### 맥락

Electron 앱은 Renderer가 UI를 담당하지만, Renderer에 파일 시스템, SQLite, 토큰, shell API 접근을 직접 노출하면 보안 위험이 커진다.

대안:

1. Renderer에서 직접 Notion API와 SQLite 접근
2. Main Process에서 모든 privileged operation 수행
3. 별도 로컬 백엔드 서버 실행
4. preload에서 넓은 API 노출

### 결정

MVP는 Main Process가 Notion API 호출, SQLite 접근, safeStorage, 외부 URL 열기, migration을 담당한다. Renderer는 제한된 IPC API만 호출한다.

Preload는 최소 API만 contextBridge로 노출하고, 모든 IPC 요청은 sender와 payload를 검증한다.

### 근거

1. Electron 보안 문서는 원격 콘텐츠에 Electron/Node 권한을 노출하지 말 것을 권고한다.
2. Notion 토큰과 SQLite 파일은 privileged resource다.
3. Renderer는 XSS와 UI 입력 위험에 더 노출되어 있다.
4. 별도 로컬 서버는 MVP에 과한 복잡성을 만든다.

### 결과

긍정적 결과:

1. 보안 경계가 명확하다.
2. 토큰과 DB 접근을 중앙에서 통제할 수 있다.
3. 테스트 가능한 service layer를 구성하기 쉽다.

부정적 결과:

1. IPC contract를 설계해야 한다.
2. 장시간 작업이 Main Process를 막지 않도록 주의해야 한다.
3. Renderer 개발자가 직접 DB 접근을 할 수 없어 초기 개발 편의성은 낮아질 수 있다.

### 후속 조치

1. IPC 채널 목록과 request/response 타입을 SDD에서 정의한다.
2. long-running sync는 progress event와 cancel 기능을 포함한다.
3. URL open, token read, DB write는 모두 Main Process service로 제한한다.

---

## ADR-015 — Review Source 식별과 삭제 정책을 명시적으로 고정

### 상태

Accepted

### 결정일

2026-06-12

### 맥락

Review Source와 필드 매핑 구현이 SRS보다 먼저 구체화되면서 다음 정책이 불명확해졌다.

1. Database 입력에서 여러 Data Source가 발견될 때의 처리
2. 동일한 normalized Notion Target의 중복 등록 허용 여부
3. Source 삭제 시 단독 참조 Review Item의 처리 선택지
4. Source가 없는 Item을 위한 `orphaned` 상태 사용 여부
5. 삭제된 Source를 대신하는 `system-deleted` sentinel Source 사용 여부
6. Source 삭제 시 Review Log 완전 삭제 허용 여부

### 결정

#### Notion Target 해석

1. 사용자는 Database 또는 Data Source URL/ID를 입력할 수 있다.
2. 내부에서는 Data Source를 우선 사용한다.
3. Database 입력이 정확히 하나의 Data Source로 해석되면 해당 Data Source로 정규화한다.
4. 여러 Data Source가 발견되면 자동 선택하지 않고 등록을 거부한다.
5. 사용자는 등록할 Data Source URL/ID를 직접 입력해야 한다.
6. 기존 Database Query API fallback은 MVP 등록 경로로 사용하지 않는다.

#### Source 중복

1. 활성 Source의 normalized `notionTargetId`는 유일해야 한다.
2. 동일 Target의 중복 등록은 경고와 함께 거부한다.
3. 강제 등록 옵션은 제공하지 않는다.
4. 삭제된 Source와 같은 Target은 기존 삭제 처리가 완료된 후 다시 등록할 수 있다.

#### Source 삭제

Source 삭제 전에 단독 참조 Item과 공유 Item의 영향 범위를 표시한다. 단독 참조
Review Item에는 다음 세 정책을 모두 제공한다.

| 정책 | Review Item 처리 | Review Log 처리 |
| --- | --- | --- |
| `archive` | 전체 메타데이터를 유지하고 `archived`로 전환 | 항상 보존 |
| `delete` | 최소 식별 메타데이터를 가진 `deleted` tombstone으로 전환 | 항상 보존 |
| `keep-history` | 운영 Review Item은 제거하고 Review Log snapshot만 유지 | 항상 보존 |

공유 Item은 삭제한 Source 참조만 제거하고 다른 Source 참조와 Review Item을 유지한다.

#### 상태와 참조 모델

1. `orphaned`는 공식 ReviewItem 상태로 사용하지 않는다.
2. `system-deleted` sentinel Source를 만들지 않는다.
3. 활성 Source가 없는 `archived` 또는 `deleted` Item은 `primarySourceId = null`,
   `sourceIds = []`를 허용한다.
4. Review Log의 평가 당시 Source 정보는 삭제 가능한 Source FK에만 의존하지 않고
   immutable snapshot으로 보존한다.
5. `keep-history`로 Review Item을 제거해도 Review Log가 유지되도록 Review Log와 Item의
   삭제 결합을 해제한다.
6. Source 삭제는 Source, Item 참조, tombstone 또는 history 전환을 하나의 transaction으로
   처리한다.

#### Review Log

1. MVP에서는 Source 삭제를 이유로 Review Log를 완전 삭제할 수 없다.
2. `archive`, `delete`, `keep-history` 모두 기존 Review Log를 보존한다.
3. 완전 삭제 기능은 별도 개인정보/데이터 삭제 정책과 ADR 없이 추가하지 않는다.

### 근거

1. 여러 Data Source 중 첫 항목 자동 선택은 사용자가 의도하지 않은 데이터를 수집할 수 있다.
2. 동일 Target 중복 Source는 동기화, 삭제 영향, 필드 매핑의 책임을 불필요하게 중복시킨다.
3. 세 삭제 정책은 사용자가 Item 메타데이터 보존 수준을 명시적으로 선택하게 한다.
4. `orphaned`와 `system-deleted`는 현재 SRS에 없는 숨은 도메인 개념이며 상태 전이와 UI를
   복잡하게 만든다.
5. Review Log는 제품의 복습 이력이며 Source 생명주기보다 오래 유지되어야 한다.

### 결과

긍정적 결과:

1. Source 등록과 삭제 동작이 사용자에게 예측 가능해진다.
2. 숨겨진 sentinel Source 없이 도메인 모델을 설명할 수 있다.
3. Review Log 보존 원칙이 모든 삭제 정책에서 일관된다.
4. Database/Data Source 오선택 가능성을 제거한다.

부정적 결과:

1. 현재 `orphaned`와 `system-deleted` 구현은 이 결정과 불일치한다.
2. `primarySourceId` nullable 처리와 Review Log snapshot 보존을 위한 schema migration이
   필요하다.
3. `keep-history`는 Review Item 제거 후에도 Review Log를 유지할 수 있도록 FK 계약을
   변경해야 한다.
4. 세 삭제 정책을 설명하고 선택받는 UI가 필요하다.

### 후속 조치

1. SRS-FR-010, SRS-FR-012, 데이터 모델, 상태 모델을 이 결정에 맞춘다.
2. `orphaned`와 `system-deleted`를 제거하는 migration 및 service repair TC를 먼저 정의한다.
3. Review Log에 필요한 Source snapshot 필드를 TC에서 확정한다.
4. 삭제 정책별 transaction과 로그 보존 TC를 분리한다.
5. 기존 데이터 migration 실패 시 rollback 동작을 검증한다.

---

## 결정 간 의존성

| 결정 | 의존 대상 | 설명 |
| --- | --- | --- |
| ADR-002 | ADR-001 | Electron 로컬 앱이므로 SQLite 파일 저장이 자연스럽다. |
| ADR-003 | ADR-004 | Notion Target 해석 후 Source별 필드 매핑이 필요하다. |
| ADR-006 | ADR-002 | FSRS 상태와 Review Log를 SQLite에 저장한다. |
| ADR-007 | ADR-001, ADR-014 | safeStorage는 Electron Main Process에서 사용한다. |
| ADR-008 | ADR-014 | 내부 뷰어는 Renderer 권한 경계와 분리되어야 한다. |
| ADR-010 | ADR-009 | 수동 동기화 흐름에서 missing/deleted 전이를 처리한다. |
| ADR-011 | ADR-006 | 변경 처리 시 FSRS 상태를 임의 변경하지 않는다. |
| ADR-012 | ADR-006 | 4단계 버튼 평가가 FSRS rating으로 매핑된다. |
| ADR-013 | ADR-003 | Notion API 호출은 페이지 속성 중심으로 제한한다. |
| ADR-015 | ADR-002, ADR-003, ADR-005 | Source 정규화와 삭제 정책은 SQLite, Notion Target, Page ID 식별 규칙에 의존한다. |

---

## Architecture Risk Register

| ID | 리스크 | 영향 | 완화 |
| --- | --- | --- | --- |
| R-001 | Notion API Data Source 전환으로 기존 DB URL 처리 실패 | Source 등록 실패 | Target Resolver와 API version 테스트 |
| R-002 | Electron 내부 뷰어에서 Notion 로그인/권한 문제 | 문서 열람 실패 | 외부 브라우저 fallback |
| R-003 | 토큰 저장 backend 보호 수준 차이 | 토큰 노출 위험 | safeStorage backend 확인, 취약 backend 저장 제한 |
| R-004 | better-sqlite3 native packaging 문제 | 배포 실패 | 초기 Windows packaging spike |
| R-005 | FSRS 라이브러리 상태 구조 변경 | dueAt 계산 회귀 | SchedulingService 래퍼와 fixture 테스트 |
| R-006 | 삭제와 권한 오류 혼동 | 데이터 손실 | missing 상태와 재확인 절차 |
| R-007 | 랜덤순이 매번 바뀌어 사용자 혼란 | UX 저하 | 세션 고정 여부 결정 |
| R-008 | 동기화 중 UI 멈춤 | 사용성 저하 | progress 표시, batch 처리, 필요 시 worker |
| R-009 | Renderer XSS가 privileged API 호출 | 보안 사고 | 최소 IPC, sender 검증, context isolation |
| R-010 | Notion 본문 미저장으로 오프라인 사용 불가 | 기능 기대 차이 | 제품 설명과 Non-Goal 명확화 |

---

## 참고 근거

1. Notion API — Query a data source: https://developers.notion.com/reference/query-a-data-source
2. Notion API — Retrieve a page: https://developers.notion.com/reference/retrieve-a-page
3. Notion API — Page object: https://developers.notion.com/reference/page
4. Notion API — Request limits: https://developers.notion.com/reference/request-limits
5. Notion API — Connection capabilities: https://developers.notion.com/reference/capabilities
6. Electron Security: https://www.electronjs.org/docs/latest/tutorial/security
7. Electron Web Embeds: https://www.electronjs.org/docs/latest/tutorial/web-embeds/
8. Electron WebContentsView: https://www.electronjs.org/docs/latest/api/web-contents-view
9. Electron safeStorage: https://www.electronjs.org/docs/latest/api/safe-storage
10. Electron shell: https://www.electronjs.org/docs/latest/api/shell/
11. ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs
12. better-sqlite3: https://github.com/WiseLibs/better-sqlite3

---

## 다음에 작성할 후보 ADR

1. ADR-016 — SQLite schema migration tool 선택
2. ADR-017 — UI framework와 state management 선택
3. ADR-018 — Windows packaging 방식 선택
4. ADR-019 — 테스트 전략과 E2E 도구 선택
5. ADR-020 — 랜덤순 세션 고정 정책
6. ADR-021 — 평가 되돌리기 지원 여부
7. ADR-022 — 자동 동기화 도입 조건
