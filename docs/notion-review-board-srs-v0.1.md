# SRS — Notion Review Board

| 항목 | 내용 |
| --- | --- |
| 문서 종류 | SRS (Software Requirements Specification) |
| 제품명 | Notion Review Board |
| 버전 | v0.1-draft |
| 상태 | PRD v0.1 기반 초안 |
| 기준 PRD | `PRD-v0.1.md` |
| 작성일 | 2026-06-11 |
| 시간대 기준 | Asia/Seoul |
| 실행 환경 | Electron 데스크톱 앱 |
| 1차 플랫폼 | Windows 우선 |
| 저장 방식 | 로컬 SQLite |
| 복습 엔진 | FSRS 기반 간격 반복 |
| 문서 열람 방식 | Electron 내부 뷰어 우선, 실패 시 외부 브라우저 |
| 본문 저장 정책 | Notion 페이지 본문 전체 미저장 |

---

## 1. 목적

본 문서는 Notion Review Board의 1차 MVP 구현을 위한 소프트웨어 요구사항을 정의한다.

Notion Review Board는 사용자가 지정한 Notion 데이터베이스 또는 데이터 소스에서 개별 Notion 페이지를 수집하고, 이를 하나의 통합 복습 큐로 관리하며, FSRS 기반으로 다음 복습일을 계산하는 로컬 우선 Electron 데스크톱 앱이다.

본 SRS는 다음 산출물의 기준 문서로 사용한다.

1. UI/UX 설계
2. 데이터베이스 스키마 설계
3. 동기화 설계
4. Notion API 연동 설계
5. FSRS 스케줄링 설계
6. Electron 보안 설계
7. 테스트 계획과 인수 기준

---

## 2. 범위

### 2.1 포함 범위

MVP는 다음을 포함한다.

1. Notion 연동 토큰 설정
2. Review Source 등록, 수정, 삭제, 활성/비활성
3. Source별 필드 매핑
4. Source별 수집 방식 설정
5. 태그/분류 기반 수집
6. 체크박스 기반 수집
7. 데이터베이스 또는 데이터 소스 전체 수집
8. 수동 동기화
9. 여러 Source의 Review Item을 하나의 Review Queue로 병합
10. 오늘 복습 목록 생성
11. 날짜순 보기
12. 랜덤순 보기
13. 특정 태그/분류 보기
14. 미분류 항목 표시
15. Electron 내부 Notion 페이지 열람
16. 외부 브라우저 열기 fallback
17. 4단계 복습 평가
18. FSRS 기반 다음 복습일 계산
19. Review Log 저장
20. 변경된 페이지 화면
21. 삭제 또는 누락 후보 페이지 화면
22. 동기화 오류 표시

### 2.2 제외 범위

MVP는 다음을 포함하지 않는다.

1. iPad 네이티브 앱
2. 모바일 앱
3. 웹 SaaS 운영
4. 팀 계정, 공유, 협업
5. Notion 페이지 본문 전체 저장
6. Notion 페이지 본문 복제
7. AI 요약 또는 AI 퀴즈 생성
8. Anki 카드 생성 또는 양방향 동기화
9. Notion 문서 편집
10. Notion DB 구조 자동 변경
11. 클라우드 서버 기반 중앙 동기화
12. 모바일 푸시, 이메일, 캘린더 알림
13. 고급 통계, Heatmap, 백업/복원
14. OCR 또는 PDF 본문 추출
15. 다중 기기 실시간 동기화

---

## 3. 제품 개요

### 3.1 제품 관점

앱은 Notion을 대체하지 않는다. Notion은 학습 문서 저장소로 유지하고, 앱은 문서 단위 복습 큐와 반복 복습 일정을 관리한다.

시스템은 다음 경계를 가진다.

| 경계 | 책임 |
| --- | --- |
| Notion | 원본 문서, 페이지 메타데이터, 사용자 권한 |
| Notion API | 데이터베이스/데이터 소스 조회, 페이지 속성 조회 |
| Electron Main Process | OS 통합, SQLite 접근, 토큰 암복호화, Notion API 호출, 외부 URL 열기 제어 |
| Electron Renderer | 화면 렌더링, 사용자 입력, 복습 목록/설정 UI |
| Electron 내부 뷰어 | Notion Page URL 열람 |
| SQLite | Review Source, Review Item, FSRS 상태, Review Log, Sync Event 저장 |

### 3.2 주요 사용자

1. 개인 학습자
2. 시험 준비자
3. 개발 학습자
4. 앱 설정과 동기화 상태를 직접 관리하는 운영 사용자

### 3.3 핵심 사용자 흐름

1. 사용자가 Notion API 토큰을 입력한다.
2. 사용자가 Review Source를 등록한다.
3. 사용자가 Source별 필드 매핑과 수집 기준을 설정한다.
4. 사용자가 수동 동기화를 실행한다.
5. 앱이 Notion에서 페이지 메타데이터를 조회한다.
6. 앱이 Review Item을 생성하거나 갱신한다.
7. 사용자가 Today Review 화면에서 오늘 복습할 문서를 선택한다.
8. 앱이 Notion 페이지 URL을 내부 뷰어에서 연다.
9. 사용자가 문서를 읽고 4단계 중 하나로 평가한다.
10. 앱이 Review Log를 저장하고 FSRS 기반으로 다음 복습일을 계산한다.
11. 변경/삭제/오류 항목은 별도 화면에서 사용자가 처리한다.

---

## 4. 용어

| 용어 | 정의 |
| --- | --- |
| Review Source | 사용자가 복습 대상으로 등록한 Notion 데이터베이스 또는 Notion API의 데이터 소스 |
| Review Item | 복습 대상이 되는 개별 Notion 페이지 |
| Review Queue | 여러 Source에서 수집한 Review Item을 병합한 통합 큐 |
| Today Review | `dueAt <= today`이고 `status = active`인 Review Item 목록 |
| Review Log | 사용자가 복습을 완료할 때마다 저장되는 평가 기록 |
| FSRS | Free Spaced Repetition Scheduler 계열의 간격 반복 알고리즘 |
| dueAt | 다음 복습 예정일 |
| lastReviewedAt | 마지막 복습 시각 |
| changed | Notion 수정 시각이 앱이 가진 기준보다 최신인 상태 |
| missing | 동기화에서 일시적으로 누락되었으나 삭제 확정 전인 상태 |
| deleted | 삭제 또는 접근 불가가 재확인되어 active queue에서 제외된 상태 |
| sync_error | 동기화 중 오류가 발생한 상태 |
| 미분류 | 태그 또는 분류 값이 없는 항목을 표시하는 기본 그룹명 |

---

## 5. 전제와 제약

### 5.1 전제

1. 사용자는 Notion API 토큰을 직접 발급하고 앱에 입력할 수 있다.
2. 사용자는 대상 Notion 데이터베이스 또는 데이터 소스를 Notion Integration에 공유할 수 있다.
3. 사용자는 로컬 PC에서 앱을 실행한다.
4. MVP 사용자는 1인 사용자다.
5. Review Item의 원본 본문은 Notion에 유지된다.
6. 앱은 Review Item 열람을 위해 Notion Page ID와 URL을 저장한다.
7. 앱은 동기화를 자동으로 실행하지 않고, MVP에서는 사용자의 수동 실행을 기본으로 한다.

### 5.2 제약

1. Windows를 1차 플랫폼으로 한다.
2. macOS와 Linux는 설계상 확장 가능해야 하지만 MVP 검증 범위는 후순위다.
3. 앱은 Notion API의 rate limit과 pagination을 처리해야 한다.
4. 앱은 Notion API 버전 변화에 대비해야 한다.
5. 앱은 Electron에서 원격 콘텐츠를 표시할 때 Node.js 권한을 노출하지 않아야 한다.
6. 앱은 Notion 페이지 본문 전체를 저장하지 않아야 한다.
7. 앱은 삭제, 권한 오류, API 오류, 필터 변경으로 인한 누락을 구분해야 한다.
8. 드래그 앤 드롭은 보조 UX이며, 복습 평가는 버튼으로도 반드시 가능해야 한다.

---

## 6. 기능 요구사항

각 요구사항은 `SRS-FR-###` 형식으로 식별한다.

### 6.1 Notion 연동 설정

#### SRS-FR-001 — Notion 토큰 입력

앱은 사용자가 Notion API 토큰을 입력할 수 있는 설정 UI를 제공해야 한다.

수용 기준:

1. 사용자는 토큰을 새로 저장할 수 있다.
2. 사용자는 저장된 토큰을 교체할 수 있다.
3. 화면에는 토큰 원문을 기본 표시하지 않는다.
4. 저장 실패 시 원인을 사용자에게 알린다.
5. 토큰이 없으면 동기화를 시작하지 않고 설정 안내를 표시한다.

#### SRS-FR-002 — Notion 토큰 저장

앱은 Notion API 토큰을 로컬에 저장할 때 일반 텍스트 노출을 피해야 한다.

수용 기준:

1. Windows에서는 OS 제공 암호화 기능을 사용하는 저장 방식을 우선한다.
2. 저장소 암호화가 불가능한 환경에서는 저장을 거부하거나 사용자에게 명시적 경고를 제공한다.
3. 로그, 오류 메시지, Sync Event에는 토큰 값을 기록하지 않는다.
4. 토큰 삭제 기능을 제공한다.

#### SRS-FR-003 — Notion 연결 검증

앱은 저장된 토큰으로 Notion API 연결 가능 여부를 검증할 수 있어야 한다.

수용 기준:

1. 검증 성공/실패 상태를 표시한다.
2. 인증 실패, 권한 부족, 네트워크 오류, rate limit을 구분해 표시한다.
3. 검증 실패해도 저장된 Review Source와 Review Log를 삭제하지 않는다.

---

### 6.2 Review Source 관리

#### SRS-FR-010 — Source 등록

앱은 사용자가 Review Source를 1개 이상 등록할 수 있어야 한다.

필수 입력:

1. 소스 이름
2. Notion Database URL, Database ID, Data Source URL 또는 Data Source ID
3. 수집 방식
4. 제목 속성 매핑
5. 활성 여부

조건부 입력:

1. 체크박스 기반 수집 시 체크박스 속성 매핑
2. 태그/분류 기반 수집 시 필터 속성, 연산자, 값

선택 입력:

1. URL 속성
2. 분류 속성
3. 태그 속성
4. 출처 속성
5. 마지막 수정 시각 속성 또는 Notion 기본 `last_edited_time`

수용 기준:

1. 필수값이 없으면 저장하지 않는다.
2. Source 이름은 앱 내부에서 식별 가능해야 한다.
3. 같은 Notion 대상이 중복 등록될 경우 경고를 표시한다.
4. 중복 등록을 완전히 금지할지 여부는 SDD에서 확정한다.

#### SRS-FR-011 — Source 수정

앱은 기존 Review Source의 설정을 수정할 수 있어야 한다.

수용 기준:

1. 사용자는 이름, 활성 여부, 수집 방식, 필드 매핑, 필터 조건을 수정할 수 있다.
2. 수정은 기존 Review Log를 삭제하지 않는다.
3. Source 설정 변경 후 다음 동기화에서 변경된 기준을 적용한다.
4. 수집 기준 변경으로 누락된 기존 항목은 즉시 삭제하지 않고 missing 후보로 처리한다.

#### SRS-FR-012 — Source 삭제

앱은 Review Source를 삭제할 수 있어야 한다.

수용 기준:

1. 삭제 전에 영향 범위를 안내한다.
2. Source 삭제 시 해당 Source만 참조하던 Review Item의 처리 방식을 사용자에게 선택하게 한다.
3. 여러 Source에서 참조되는 Review Item은 다른 Source 참조를 보존한다.
4. Review Log 보존 정책은 SRS-OPEN-004에서 확정 전까지 삭제하지 않는 것을 기본 안전값으로 한다.

#### SRS-FR-013 — Source 활성/비활성

앱은 Source별 활성 여부를 관리해야 한다.

수용 기준:

1. 비활성 Source는 수동 동기화 대상에서 제외한다.
2. 비활성 Source의 기존 Review Item은 자동 삭제하지 않는다.
3. 비활성 Source에서 온 Review Item을 Today Review에 포함할지 여부는 Source 참조가 아닌 Item status와 dueAt을 기준으로 한다.

---

### 6.3 필드 매핑

#### SRS-FR-020 — Source별 필드 매핑

앱은 각 Review Source마다 별도의 필드 매핑을 저장해야 한다.

매핑 대상:

1. 제목 속성
2. URL 속성
3. 분류 속성
4. 태그 속성
5. 출처 속성
6. 체크박스 속성
7. Notion 수정 시각 기준

수용 기준:

1. 제목 속성은 필수다.
2. URL 속성이 없으면 Notion Page URL을 사용한다.
3. 분류와 태그 속성은 선택이다.
4. 분류와 태그가 모두 없거나 값이 비어 있으면 앱은 `미분류`로 표시한다.
5. 체크박스 기반 수집에서는 체크박스 속성이 필수다.

#### SRS-FR-021 — 필드 매핑 검증

앱은 사용자가 저장하기 전에 매핑 결과를 검증할 수 있어야 한다.

수용 기준:

1. Source의 속성 목록을 조회할 수 있어야 한다.
2. 선택한 속성이 존재하지 않으면 저장 또는 동기화 전에 오류를 표시한다.
3. 속성 타입이 수집 방식과 맞지 않으면 오류 또는 경고를 표시한다.
4. 검증 결과에는 샘플 페이지의 제목, URL, 분류/태그, 체크박스 값이 표시되어야 한다.

#### SRS-FR-022 — 자동 추론 제한

MVP는 Notion 속성 자동 추론을 필수 기능으로 하지 않는다.

수용 기준:

1. 사용자가 직접 속성을 선택하는 흐름이 완성되어야 한다.
2. 자동 추천이 구현되더라도 사용자가 최종 매핑을 확인해야 한다.
3. 자동 추론 실패가 동기화 실패로 이어지지 않아야 한다.

---

### 6.4 수집 기준

#### SRS-FR-030 — 태그/분류 기반 수집

앱은 지정한 속성의 값 조건에 맞는 페이지를 수집할 수 있어야 한다.

지원 조건:

1. `equals`
2. `contains`

수용 기준:

1. select, multi_select, status, rich_text 계열 속성에 대해 타입별 가능한 조건을 정의한다.
2. 값 조건이 비어 있으면 저장하지 않는다.
3. 조건에 맞는 페이지가 없으면 오류가 아니라 빈 결과로 표시한다.
4. 복잡한 AND/OR 조건은 MVP 필수 범위가 아니다.

#### SRS-FR-031 — 체크박스 기반 수집

앱은 지정한 체크박스 속성이 체크된 페이지를 수집할 수 있어야 한다.

수용 기준:

1. 체크박스 속성 매핑이 없으면 설정 저장 또는 동기화를 막는다.
2. 체크박스 값이 true인 페이지만 수집한다.
3. 체크박스 속성이 사라졌거나 타입이 바뀌면 Source 오류로 표시한다.

#### SRS-FR-032 — 전체 수집

앱은 지정한 Source의 모든 페이지를 수집할 수 있어야 한다.

수용 기준:

1. 별도 태그나 체크박스가 없어도 수집한다.
2. pagination이 있는 경우 모든 페이지를 순회한다.
3. 비활성 Source는 전체 수집에서도 제외한다.

---

### 6.5 동기화

#### SRS-FR-040 — 수동 동기화

앱은 사용자가 명시적으로 동기화를 실행할 수 있어야 한다.

수용 기준:

1. 사용자는 전체 활성 Source를 동기화할 수 있다.
2. 사용자는 단일 Source를 동기화할 수 있다.
3. 동기화 진행 상태를 볼 수 있어야 한다.
4. 동기화 중 오류가 발생해도 이미 성공한 Source 결과를 가능한 한 보존한다.
5. 동기화 완료 후 생성, 갱신, 변경 감지, 누락 감지, 오류 개수를 표시한다.

#### SRS-FR-041 — Notion 조회 pagination

앱은 Notion API 응답이 여러 페이지로 나뉘는 경우 다음 cursor를 사용해 결과를 끝까지 조회해야 한다.

수용 기준:

1. `has_more` 또는 `next_cursor`에 해당하는 응답을 처리한다.
2. 중간 페이지에서 오류가 발생하면 해당 Source의 동기화 오류로 기록한다.
3. 중복 페이지가 응답될 경우 Notion Page ID 기준으로 한 번만 반영한다.

#### SRS-FR-042 — Notion rate limit 처리

앱은 Notion API rate limit 응답을 처리해야 한다.

수용 기준:

1. HTTP 429를 별도 오류로 인식한다.
2. `Retry-After` 헤더가 있으면 그 값을 존중하는 재시도 정책을 사용한다.
3. 재시도 횟수와 총 대기 한도를 둔다.
4. 사용자가 동기화를 취소할 수 있어야 한다.
5. 재시도 후 실패하면 sync_error로 기록한다.

#### SRS-FR-043 — 새 페이지 생성

동기화 결과 Notion Page ID가 기존 Review Item에 없으면 앱은 새 Review Item을 생성해야 한다.

수용 기준:

1. `status` 기본값은 `active`다.
2. 최초 `dueAt`은 오늘 또는 설정된 초기 복습 정책에 따른다.
3. `createdAt`, `updatedAt`, `lastSyncedAt`을 기록한다.
4. `sourceIds`에 현재 Source를 추가한다.
5. `fsrsState` 초기값을 생성한다.

#### SRS-FR-044 — 기존 페이지 갱신

동일한 Notion Page ID가 다시 수집되면 앱은 기존 Review Item을 갱신해야 한다.

수용 기준:

1. 중복 Review Item을 생성하지 않는다.
2. 제목, URL, 분류/태그, 출처, Notion 수정 시각, 마지막 동기화 시각을 갱신한다.
3. `sourceIds`에 현재 Source가 없으면 추가한다.
4. 기존 `dueAt`, `lastReviewedAt`, `fsrsState`, Review Log는 동기화만으로 변경하지 않는다.
5. 변경 감지 규칙에 해당하면 changed 상태 또는 변경 목록에 반영한다.

#### SRS-FR-045 — Source 간 병합

앱은 여러 Source에서 동일한 Notion Page ID가 수집되면 하나의 Review Item으로 병합해야 한다.

수용 기준:

1. 1차 식별자는 Notion Page ID다.
2. 같은 Page ID는 하나의 Review Item만 유지한다.
3. 여러 Source 참조는 `sourceIds`에 보존한다.
4. `primarySourceId` 선택 규칙은 최초 수집 Source를 기본으로 한다.
5. URL만 같고 Page ID가 다른 항목은 자동 병합하지 않는다.
6. 제목만 같은 항목은 중복으로 보지 않는다.

---

### 6.6 Today Review

#### SRS-FR-050 — 오늘 복습 목록 생성

앱은 오늘 복습 목록을 생성해야 한다.

조건:

```sql
due_at <= today
status = 'active'
```

수용 기준:

1. 날짜 비교는 사용자 로컬 날짜 기준으로 수행한다.
2. 완료 평가된 항목은 새 `dueAt`이 미래면 목록에서 빠진다.
3. `changed`, `deleted`, `missing`, `sync_error`, `archived` 항목은 Today Review에서 제외한다.
4. 빈 목록이면 완료 또는 동기화 안내를 표시한다.

#### SRS-FR-051 — Today Review 표시 정보

Today Review 항목은 다음 정보를 표시해야 한다.

1. 제목
2. 원본 Source
3. 분류 또는 태그
4. 출처
5. dueAt
6. lastReviewedAt
7. 현재 status
8. 문서 열기 버튼
9. 난이도 평가 버튼

수용 기준:

1. 긴 제목은 화면을 깨지 않도록 줄임 또는 줄바꿈 처리한다.
2. 분류/태그가 없으면 `미분류`로 표시한다.
3. 열 수 없는 항목은 사용자에게 원인을 표시하고 동기화/권한 확인을 안내한다.

#### SRS-FR-052 — 날짜순 보기

앱은 Today Review의 기본 보기로 dueAt 오름차순 정렬을 제공해야 한다.

수용 기준:

1. dueAt이 오래된 항목이 먼저 표시된다.
2. dueAt이 같으면 lastReviewedAt이 오래되었거나 없는 항목을 먼저 표시할 수 있다.
3. 정렬 기준은 UI에 명확히 표시한다.

#### SRS-FR-053 — 랜덤순 보기

앱은 Today Review 대상 안에서 랜덤순 보기를 제공해야 한다.

수용 기준:

1. 랜덤순은 사용자가 명시적으로 선택할 때만 적용한다.
2. 랜덤순은 Today Review 조건을 만족하는 항목 안에서만 적용한다.
3. 같은 세션에서 랜덤 순서를 고정할지 여부는 SRS-OPEN-006에서 확정한다.
4. 랜덤순에서 평가 완료된 항목은 목록에서 제거되거나 완료 상태로 표시된다.

#### SRS-FR-054 — 태그/분류 보기

앱은 특정 태그 또는 분류 기준으로 Today Review를 필터링하거나 그룹화할 수 있어야 한다.

수용 기준:

1. 분류/태그 속성이 매핑된 Source에서 우선 지원한다.
2. 태그가 없는 항목은 `미분류` 그룹으로 접근 가능해야 한다.
3. 필터 적용 중에도 dueAt과 status 조건은 유지한다.
4. 필터 결과가 비어 있으면 빈 상태를 표시한다.

---

### 6.7 문서 뷰어

#### SRS-FR-060 — 내부 뷰어 열람

앱은 Review Item의 Notion Page URL을 Electron 내부 뷰어에서 열 수 있어야 한다.

수용 기준:

1. HTTPS URL만 내부 뷰어에서 열람한다.
2. 내부 뷰어는 원격 콘텐츠에 Node.js 권한을 제공하지 않는다.
3. 내부 뷰어는 앱의 로컬 데이터나 Electron API에 직접 접근할 수 없어야 한다.
4. 내부 뷰어의 navigation은 Notion 관련 허용 도메인 중심으로 제한한다.
5. 로딩 실패 시 명확한 오류와 외부 브라우저 열기 옵션을 제공한다.

#### SRS-FR-061 — 외부 브라우저 fallback

앱은 내부 뷰어에서 열람이 실패하거나 사용자가 요청할 경우 외부 브라우저로 Notion 페이지를 열 수 있어야 한다.

수용 기준:

1. 외부 열기 URL은 허용 프로토콜과 호스트를 검증한다.
2. 검증되지 않은 URL은 열지 않는다.
3. 외부 브라우저 열기 실패 시 오류를 표시한다.

#### SRS-FR-062 — 문서 정보 표시

문서 뷰어 화면은 선택한 Review Item의 정보를 함께 표시해야 한다.

표시 정보:

1. 제목
2. 원본 Source
3. 분류/태그
4. 마지막 복습일
5. 다음 복습 예정일
6. 현재 상태
7. 난이도 평가 버튼

---

### 6.8 복습 평가와 FSRS

#### SRS-FR-070 — 4단계 평가

앱은 복습 완료 평가를 4단계로 제공해야 한다.

| 앱 평가 | 내부 값 | FSRS 매핑 |
| --- | --- | --- |
| 다시 | `again` | Again |
| 어려움 | `hard` | Hard |
| 보통 | `good` | Good |
| 쉬움 | `easy` | Easy |

수용 기준:

1. 네 버튼은 Today Review와 문서 뷰어에서 모두 접근 가능해야 한다.
2. 버튼 라벨은 한국어를 기본으로 한다.
3. 원격 데스크톱/터치 사용을 고려해 버튼 크기는 충분히 커야 한다.
4. 드래그 앤 드롭 없이도 평가가 완료되어야 한다.

#### SRS-FR-071 — 평가 처리

사용자가 평가를 선택하면 앱은 다음 작업을 원자적으로 처리해야 한다.

1. Review Log 생성
2. FSRS 상태 갱신
3. next dueAt 계산
4. Review Item의 lastReviewedAt 갱신
5. Review Item의 dueAt 갱신
6. Review Item의 updatedAt 갱신

수용 기준:

1. 하나의 평가에 대해 Review Log는 정확히 한 번 생성한다.
2. DB 저장 중 실패하면 항목 상태가 부분 갱신되지 않아야 한다.
3. 저장 성공 후 UI는 최신 dueAt과 완료 상태를 반영한다.
4. 평가 직후 동일 항목을 중복 평가하지 않도록 버튼 상태를 제어한다.

#### SRS-FR-072 — FSRS 상태 저장

앱은 FSRS 계산에 필요한 상태를 Review Item에 저장해야 한다.

수용 기준:

1. 단순 dueAt만 저장하지 않는다.
2. FSRS 상태는 JSON 또는 명시 스키마로 저장한다.
3. Review Log에는 평가 전후 FSRS 상태를 기록한다.
4. FSRS 라이브러리 교체 가능성을 고려해 상태 버전을 저장한다.
5. 라이브러리 오류 시 평가를 완료하지 않고 오류를 표시한다.

---

### 6.9 변경된 페이지

#### SRS-FR-080 — 변경 감지

앱은 Notion 페이지의 수정 시각이 앱에 저장된 마지막 기준보다 최신이면 변경된 페이지로 감지할 수 있어야 한다.

수용 기준:

1. 기준 값은 Notion의 `last_edited_time` 또는 Source별 매핑된 수정 시각이다.
2. 최초 수집 시에는 변경 목록에 넣지 않는다.
3. 변경 감지는 자동으로 dueAt을 바꾸지 않는다.
4. 변경 항목은 Today Review와 별도로 확인 가능해야 한다.

#### SRS-FR-081 — 변경된 페이지 화면

앱은 변경된 페이지 목록을 별도 화면으로 제공해야 한다.

표시 정보:

1. 제목
2. 원본 Source
3. 분류/태그
4. 마지막 복습 시각
5. 마지막 동기화 시각
6. Notion 수정 시각
7. 현재 dueAt
8. 선택 가능한 처리

수용 기준:

1. 사용자는 페이지를 열 수 있다.
2. 사용자는 `오늘 복습으로 당기기`를 선택할 수 있다.
3. 사용자는 `기존 일정 유지`를 선택할 수 있다.
4. 사용자가 처리하기 전까지 자동 처리하지 않는다.

#### SRS-FR-082 — 오늘 복습으로 당기기

사용자가 변경된 페이지를 오늘 복습으로 당기면 앱은 dueAt을 오늘로 설정해야 한다.

수용 기준:

1. fsrsState 자체를 임의로 재계산하지 않는다.
2. 상태 처리 이력을 Sync Event 또는 별도 이벤트로 남긴다.
3. 항목이 active 상태이면 Today Review에 포함될 수 있다.

#### SRS-FR-083 — 기존 일정 유지

사용자가 기존 일정 유지를 선택하면 앱은 dueAt과 FSRS 상태를 유지해야 한다.

수용 기준:

1. 변경 알림은 처리 완료 상태가 된다.
2. Review Log는 생성하지 않는다.
3. dueAt과 fsrsState는 변경하지 않는다.

---

### 6.10 삭제, 누락, 오류 처리

#### SRS-FR-090 — 누락 후보 감지

동기화 결과 기존 Review Item이 더 이상 조회되지 않으면 앱은 즉시 deleted로 확정하지 않고 missing 후보로 표시해야 한다.

수용 기준:

1. 필터 변경, 권한 오류, 네트워크 오류, API 오류 가능성을 고려한다.
2. missing 상태는 active Today Review에서 제외한다.
3. 사용자가 다시 확인할 수 있어야 한다.
4. 재동기화에서 다시 발견되면 active로 복구할 수 있어야 한다.

#### SRS-FR-091 — 삭제 확정

앱은 Page ID 재확인 또는 후속 동기화 결과를 통해 삭제 상태를 확정할 수 있어야 한다.

수용 기준:

1. 삭제 확정 기준은 SRS-OPEN-003에서 최종 확정한다.
2. 삭제 확정 후 status는 `deleted`가 된다.
3. deleted 항목은 Today Review에서 제외한다.
4. Review Log는 기본적으로 보존한다.
5. 사용자는 큐에서 제거 또는 기록 보존 처리를 선택할 수 있어야 한다.

#### SRS-FR-092 — 삭제된 페이지 화면

앱은 deleted 또는 missing 후보 항목을 별도 화면에서 보여줘야 한다.

표시 정보:

1. 제목
2. 원본 Source
3. Notion Page ID
4. URL
5. 마지막 정상 동기화 시각
6. 삭제 또는 누락 감지 시각
7. 현재 상태
8. 가능한 처리 버튼

가능한 처리:

1. 복습 큐에서 제거
2. 기록만 보존
3. 삭제 후보 무시
4. 다시 확인
5. 원본 URL 열기 시도

#### SRS-FR-093 — 동기화 오류 표시

앱은 동기화 중 발생한 오류를 사용자에게 표시해야 한다.

수용 기준:

1. Source 단위 오류와 Item 단위 오류를 구분한다.
2. 인증 오류, 권한 오류, rate limit, 네트워크 오류, 스키마/속성 오류를 구분한다.
3. 오류 메시지는 사용자가 다음 조치를 이해할 수 있어야 한다.
4. 토큰, 내부 stack trace, 민감 정보는 사용자 화면과 로그에 노출하지 않는다.

---

### 6.11 칸반 보드

#### SRS-FR-100 — 칸반 보드 후보

칸반 보드는 MVP 필수 기능이 아니라 P1 또는 MVP 보조 기능으로 둔다.

컬럼 후보:

1. 오늘 복습
2. 다시
3. 어려움
4. 보통
5. 쉬움

수용 기준:

1. 칸반이 구현되더라도 버튼 평가 기능은 반드시 유지한다.
2. 드래그 앤 드롭 평가는 버튼 평가와 동일한 평가 처리 로직을 사용한다.
3. 드래그 실수에 대한 취소 또는 확인 흐름은 P1에서 검토한다.

---

## 7. 데이터 요구사항

### 7.1 저장 원칙

1. 로컬 SQLite를 사용한다.
2. Notion 페이지 본문 전체는 저장하지 않는다.
3. Review Source 설정과 필드 매핑을 저장한다.
4. Review Item, FSRS 상태, Review Log, Sync Event를 저장한다.
5. 개인정보와 토큰은 최소 저장한다.
6. 저장 시각은 ISO 8601 형식으로 저장한다.
7. 날짜 기반 dueAt 비교는 사용자 로컬 날짜 기준으로 처리한다.

### 7.2 ReviewSource

필수 필드:

| 필드 | 설명 |
| --- | --- |
| id | 앱 내부 Source ID |
| name | 앱 표시명 |
| notionTargetId | Notion Database ID 또는 Data Source ID |
| notionTargetUrl | 입력된 URL |
| notionTargetType | `database`, `data_source`, `unknown` |
| enabled | 활성 여부 |
| collectionMode | `tag`, `checkbox`, `all` |
| titlePropertyName | 제목 속성 |
| createdAt | 생성 시각 |
| updatedAt | 수정 시각 |

선택 또는 조건부 필드:

| 필드 | 설명 |
| --- | --- |
| urlPropertyName | URL 속성 |
| categoryPropertyName | 분류 속성 |
| tagPropertyName | 태그 속성 |
| sourcePropertyName | 출처 속성 |
| reviewCheckboxPropertyName | 체크박스 기반 수집용 속성 |
| filterPropertyName | 태그/분류 기반 수집용 속성 |
| filterOperator | `equals`, `contains`, `checked` |
| filterValue | 필터 값 |
| lastSyncedAt | 마지막 동기화 시각 |

### 7.3 ReviewItem

필수 필드:

| 필드 | 설명 |
| --- | --- |
| id | 앱 내부 Item ID |
| notionPageId | Notion Page ID |
| notionUrl | Notion Page URL |
| title | 표시 제목 |
| primarySourceId | 대표 Source |
| sourceIds | 참조 Source 목록 |
| dueAt | 다음 복습 예정일 |
| fsrsState | FSRS 상태 |
| status | 상태 |
| createdAt | 생성 시각 |
| updatedAt | 수정 시각 |

선택 필드:

| 필드 | 설명 |
| --- | --- |
| category | 없으면 미분류 |
| tags | 태그 목록 |
| originLabel | 출처 |
| lastReviewedAt | 마지막 복습 시각 |
| notionLastEditedAt | Notion 수정 시각 |
| lastSyncedAt | 마지막 동기화 시각 |
| missingDetectedAt | 누락 감지 시각 |
| deletedDetectedAt | 삭제 감지 시각 |

### 7.4 ReviewLog

필드:

| 필드 | 설명 |
| --- | --- |
| id | 로그 ID |
| reviewItemId | Review Item ID |
| rating | `again`, `hard`, `good`, `easy` |
| reviewedAt | 평가 시각 |
| previousDueAt | 평가 전 dueAt |
| nextDueAt | 평가 후 dueAt |
| previousFsrsState | 평가 전 FSRS 상태 |
| nextFsrsState | 평가 후 FSRS 상태 |
| sourceId | 평가 당시 대표 Source |
| category | 평가 당시 분류 |
| createdAt | 생성 시각 |

### 7.5 SyncEvent

필드:

| 필드 | 설명 |
| --- | --- |
| id | 이벤트 ID |
| sourceId | 관련 Source ID |
| reviewItemId | 관련 Item ID |
| eventType | 이벤트 유형 |
| severity | `info`, `warning`, `error` |
| message | 사용자에게 표시 가능한 메시지 |
| technicalMessage | 민감 정보 제거 후 내부 확인용 메시지 |
| occurredAt | 발생 시각 |

이벤트 유형:

1. `created`
2. `updated`
3. `changed_detected`
4. `missing_detected`
5. `deleted_detected`
6. `sync_error`
7. `reviewed`
8. `user_action`

---

## 8. 상태 모델

### 8.1 ReviewItem status

| 상태 | 의미 | Today Review 포함 |
| --- | --- | --- |
| active | 정상 복습 대상 | 가능 |
| changed | Notion 변경 감지, 사용자 처리 필요 | 제외 |
| missing | 동기화에서 누락, 삭제 확정 전 | 제외 |
| deleted | 삭제 또는 접근 불가 확정 | 제외 |
| sync_error | 항목 단위 동기화 오류 | 제외 |
| archived | 사용자가 큐에서 보관 처리 | 제외 |

### 8.2 상태 전이

1. 새 수집: 없음 → active
2. 정상 갱신: active → active
3. 변경 감지: active → changed 또는 active + 변경 목록 플래그
4. 변경 처리, 오늘 당기기: changed → active, dueAt = today
5. 변경 처리, 일정 유지: changed → active, dueAt 유지
6. 동기화 누락: active → missing
7. 재발견: missing → active
8. 삭제 확정: missing → deleted
9. 사용자 보관: active/deleted/missing → archived
10. 항목 오류: active → sync_error
11. 오류 복구: sync_error → active

주의: changed를 status로 둘지 별도 플래그로 둘지는 SDD에서 확정한다. MVP 구현은 Today Review 제외 규칙과 변경 화면 표시 요구를 만족해야 한다.

---

## 9. 외부 인터페이스 요구사항

### 9.1 Notion API

앱은 Notion API와 연동해야 한다.

요구사항:

1. 인증 헤더에 사용자 토큰을 사용한다.
2. 현재 Notion API의 Database/Data Source 모델 변화를 고려한다.
3. 데이터 소스 조회 API를 우선 검토하고, 기존 Database Query API는 호환 경로로 둔다.
4. 페이지 조회는 페이지 속성과 기본 메타데이터를 얻는 용도로 사용한다.
5. 본문 블록 조회는 MVP에서 사용하지 않는다.
6. rate limit, pagination, 403, 404, 429, 5xx 오류를 처리한다.
7. Notion 권한이 없는 대상은 삭제로 단정하지 않는다.

### 9.2 Electron IPC

Renderer는 직접 토큰, SQLite, 파일 시스템, shell API에 접근하지 않아야 한다.

요구사항:

1. Renderer는 제한된 IPC API만 사용한다.
2. Main Process는 IPC sender를 검증한다.
3. IPC 입력은 타입과 값 범위를 검증한다.
4. IPC 오류 응답은 민감 정보를 제거한다.
5. Renderer에는 필요한 최소 데이터만 전달한다.

### 9.3 SQLite

요구사항:

1. DB 파일은 앱 사용자 데이터 디렉터리에 저장한다.
2. 마이그레이션 이력을 관리한다.
3. 복습 평가 저장은 트랜잭션으로 처리한다.
4. 동기화 갱신은 Source 단위 또는 batch 단위 트랜잭션으로 처리한다.
5. 인덱스는 `notionPageId`, `dueAt`, `status`, `sourceIds` 조회에 맞춰 설계한다.
6. DB 손상 또는 마이그레이션 실패 시 사용자에게 복구 안내를 제공한다.

---

## 10. 비기능 요구사항

### 10.1 보안

| ID | 요구사항 |
| --- | --- |
| SRS-NFR-SEC-001 | 원격 콘텐츠에는 Node.js integration을 활성화하지 않는다. |
| SRS-NFR-SEC-002 | Renderer에는 context isolation을 활성화한다. |
| SRS-NFR-SEC-003 | 가능한 경우 renderer sandbox를 활성화한다. |
| SRS-NFR-SEC-004 | `webSecurity`를 비활성화하지 않는다. |
| SRS-NFR-SEC-005 | 외부 URL 열기는 allowlist 검증 후 Main Process에서만 수행한다. |
| SRS-NFR-SEC-006 | Notion 토큰은 로그, 오류, 화면, DB 평문 필드에 노출하지 않는다. |
| SRS-NFR-SEC-007 | 앱은 Notion 페이지 본문 전체를 저장하지 않는다. |
| SRS-NFR-SEC-008 | IPC sender와 payload를 검증한다. |
| SRS-NFR-SEC-009 | CSP를 적용하고 앱 로컬 UI의 script source를 제한한다. |
| SRS-NFR-SEC-010 | 삭제/오류 화면에는 민감한 토큰 또는 내부 stack trace를 표시하지 않는다. |

### 10.2 신뢰성

| ID | 요구사항 |
| --- | --- |
| SRS-NFR-REL-001 | 동기화 일부 실패가 전체 로컬 데이터 손실로 이어지지 않아야 한다. |
| SRS-NFR-REL-002 | 평가 저장은 원자적으로 처리해야 한다. |
| SRS-NFR-REL-003 | Notion API rate limit과 일시적 네트워크 오류에 대해 재시도 또는 명확한 실패 상태를 제공해야 한다. |
| SRS-NFR-REL-004 | 삭제와 동기화 오류를 구분해야 한다. |
| SRS-NFR-REL-005 | 앱 재시작 후 Review Queue와 Review Log가 유지되어야 한다. |

### 10.3 성능

| ID | 요구사항 |
| --- | --- |
| SRS-NFR-PERF-001 | Today Review 목록 조회는 일반 개인 학습자 규모에서 즉시 사용 가능한 응답성을 제공해야 한다. |
| SRS-NFR-PERF-002 | 수동 동기화는 진행 상태를 표시해 사용자가 멈춘 것으로 오해하지 않게 해야 한다. |
| SRS-NFR-PERF-003 | 장기 실행 동기화는 UI 렌더링을 장시간 차단하지 않아야 한다. |
| SRS-NFR-PERF-004 | dueAt, status, notionPageId 기반 조회에는 적절한 인덱스를 사용해야 한다. |

### 10.4 사용성

| ID | 요구사항 |
| --- | --- |
| SRS-NFR-UX-001 | 기본 화면은 Today Review에 바로 접근할 수 있어야 한다. |
| SRS-NFR-UX-002 | 사용자는 문서 열람 후 같은 화면에서 평가할 수 있어야 한다. |
| SRS-NFR-UX-003 | 드래그 앤 드롭 없이도 모든 평가가 가능해야 한다. |
| SRS-NFR-UX-004 | iPad 원격 데스크톱 사용을 고려해 주요 평가 버튼은 충분히 커야 한다. |
| SRS-NFR-UX-005 | 빈 목록, 오류, 권한 부족, 토큰 없음 상태를 각각 명확히 안내해야 한다. |

### 10.5 유지보수성

| ID | 요구사항 |
| --- | --- |
| SRS-NFR-MAINT-001 | Notion API 계층은 UI와 분리한다. |
| SRS-NFR-MAINT-002 | FSRS 계산 계층은 저장소와 UI에서 분리한다. |
| SRS-NFR-MAINT-003 | SQLite schema migration은 버전 관리한다. |
| SRS-NFR-MAINT-004 | Notion API 버전 변경에 대비해 Database/Data Source 대상 해석 로직을 캡슐화한다. |
| SRS-NFR-MAINT-005 | 상태 전이와 평가 처리는 테스트 가능한 순수 로직으로 분리한다. |

### 10.6 개인정보와 데이터 최소화

| ID | 요구사항 |
| --- | --- |
| SRS-NFR-PRIV-001 | Notion 페이지 본문 전체를 저장하지 않는다. |
| SRS-NFR-PRIV-002 | 저장 데이터는 복습 큐 운영에 필요한 메타데이터로 제한한다. |
| SRS-NFR-PRIV-003 | 사용자는 로컬 DB 위치와 데이터 삭제 방법을 확인할 수 있어야 한다. |
| SRS-NFR-PRIV-004 | 외부 서버로 Review Log나 문서 메타데이터를 전송하지 않는다. |

---

## 11. UI 요구사항

### 11.1 Today Review 화면

영역:

1. 상단: 동기화 버튼, 보기 방식 선택, 태그 필터, 설정 진입
2. 좌측: 오늘 복습 목록
3. 중앙: 선택한 Notion 페이지 뷰어
4. 우측 또는 하단: 문서 정보와 평가 버튼
5. 보조 알림: 변경된 페이지, 삭제된 페이지, 동기화 오류

수용 기준:

1. 앱 시작 시 기본 진입 화면으로 사용한다.
2. 토큰 또는 Source가 없으면 설정 유도 화면을 표시한다.
3. 동기화 중에도 기존 목록을 가능한 한 유지한다.
4. 평가 완료 후 다음 항목으로 이동할 수 있어야 한다.

### 11.2 Review Source 설정 화면

기능:

1. Source 추가
2. Source 수정
3. Source 삭제
4. Source 활성/비활성
5. Notion Target URL 또는 ID 입력
6. 수집 방식 선택
7. 필드 매핑 선택
8. 수집 테스트
9. 마지막 동기화 결과 확인

### 11.3 필드 매핑 화면

기능:

1. Notion 속성 목록 표시
2. 앱 필드와 Notion 속성 연결
3. 타입 불일치 경고
4. 샘플 수집 결과 확인
5. 저장 전 검증

### 11.4 문서 뷰어 화면

기능:

1. 내부 뷰어 열람
2. 외부 브라우저로 열기
3. 새로고침
4. 현재 문서 정보 표시
5. 난이도 평가
6. 평가 실패 또는 저장 실패 안내

### 11.5 변경된 페이지 화면

기능:

1. 변경 목록 표시
2. 페이지 열기
3. 오늘 복습으로 당기기
4. 기존 일정 유지
5. 처리 완료 표시

### 11.6 삭제된 페이지 화면

기능:

1. missing/deleted 목록 표시
2. 다시 확인
3. 큐에서 제거
4. 기록 보존
5. 삭제 후보 무시
6. 원본 URL 열기 시도

---

## 12. 오류 처리 요구사항

| 오류 유형 | 사용자 표시 | 내부 처리 |
| --- | --- | --- |
| 토큰 없음 | Notion 토큰 설정 필요 | 동기화 차단 |
| 인증 실패 | 토큰 확인 필요 | Source 데이터 유지 |
| 권한 부족 | 대상 DB/Data Source 공유 필요 | 삭제로 처리하지 않음 |
| 대상 없음 404 | 접근 불가 또는 삭제 가능성 안내 | 재확인 전 missing 후보 |
| rate limit 429 | 잠시 후 재시도 중 또는 실패 | Retry-After 반영 |
| 네트워크 오류 | 네트워크 확인 필요 | sync_error 기록 |
| 속성 매핑 오류 | 필드 매핑 수정 필요 | Source sync_error |
| 내부 뷰어 실패 | 외부 브라우저 열기 제공 | viewer_error 기록 가능 |
| DB 저장 실패 | 저장 실패 안내 | 트랜잭션 rollback |
| FSRS 계산 실패 | 평가 저장 실패 안내 | Review Log 생성하지 않음 |

---

## 13. 테스트 요구사항

### 13.1 단위 테스트

1. Review Item 병합 규칙
2. 수집 모드별 필터 생성
3. 미분류 표시 규칙
4. Today Review 조건
5. 날짜순 정렬
6. 랜덤순 범위 제한
7. 4단계 평가 매핑
8. FSRS 상태 갱신 래퍼
9. ReviewItem status 전이
10. 삭제/missing 처리
11. URL allowlist 검증
12. IPC payload 검증

### 13.2 통합 테스트

1. Source 등록 → 매핑 → 수동 동기화 → Review Item 생성
2. 동일 Page ID 재동기화 시 중복 미생성
3. 여러 Source에서 같은 Page ID 수집 시 sourceIds 보존
4. 평가 완료 시 Review Log와 Review Item 동시 갱신
5. changed 감지 후 오늘 당기기
6. missing 감지 후 재발견 복구
7. Notion API 429 재시도
8. 내부 뷰어 실패 시 외부 브라우저 fallback

### 13.3 인수 테스트

1. 사용자는 Notion DB 하나를 등록하고 오늘 복습 목록을 볼 수 있다.
2. 사용자는 서로 다른 구조의 Notion DB 두 개를 등록하고 하나의 통합 큐로 볼 수 있다.
3. 사용자는 문서를 열고 `보통` 평가를 눌러 다음 복습일을 갱신할 수 있다.
4. 태그 없는 문서는 `미분류`로 표시된다.
5. 삭제 또는 접근 불가 후보는 Today Review에서 제외되고 별도 화면에 표시된다.
6. 변경된 문서는 자동 일정 변경 없이 별도 화면에서 사용자가 처리한다.
7. 내부 뷰어에서 열리지 않는 문서는 외부 브라우저로 열 수 있다.
8. 토큰이 로그 또는 화면에 노출되지 않는다.

---

## 14. 추적성 매트릭스

| PRD 섹션 | SRS 요구사항 |
| --- | --- |
| 7.1 Notion 연동 설정 | SRS-FR-001 ~ 003 |
| 7.2 Review Source 등록 | SRS-FR-010 ~ 013 |
| 7.3 필드 매핑 | SRS-FR-020 ~ 022 |
| 7.4 수집 기준 | SRS-FR-030 ~ 032 |
| 7.5 통합 Review Queue | SRS-FR-043 ~ 045 |
| 7.6 오늘 복습 목록 | SRS-FR-050 ~ 054 |
| 7.8 문서 뷰어 | SRS-FR-060 ~ 062 |
| 7.9 복습 평가 | SRS-FR-070 ~ 072 |
| 7.11 삭제된 페이지 화면 | SRS-FR-090 ~ 092 |
| 7.12 변경된 페이지 화면 | SRS-FR-080 ~ 083 |
| 7.13 동기화 | SRS-FR-040 ~ 045, SRS-FR-093 |
| 8 데이터 모델 방향 | SRS 섹션 7 |
| 9 비즈니스 규칙 | SRS 섹션 6, 8 |
| 10 운영 환경 및 제약사항 | SRS 섹션 5, 9, 10 |
| 11 주요 화면 방향 | SRS 섹션 11 |
| 13 일정 및 우선순위 | SRS 섹션 2 |
| 14 미확정 사항 | SRS 섹션 15 |

---

## 15. 미확정 사항

| ID | 항목 | 현재 안전 기본값 | 확정 필요 내용 |
| --- | --- | --- | --- |
| SRS-OPEN-001 | Notion 토큰 저장 방식 | Electron safeStorage 기반 암호화 저장 | 저장 실패/불가 환경에서 UX |
| SRS-OPEN-002 | Notion Database와 Data Source 처리 | UX는 DB/Source로 받되 내부에서 Data Source 우선 | 기존 Database Query 호환 범위 |
| SRS-OPEN-003 | 삭제 확정 기준 | missing → 재확인 후 deleted | 몇 회 누락 또는 어떤 API 응답을 확정 기준으로 볼지 |
| SRS-OPEN-004 | Source 삭제 시 Review Log 보존 | 기본 보존 | 사용자가 완전 삭제를 선택할 수 있는지 |
| SRS-OPEN-005 | 변경 감지 기준 | Notion `last_edited_time` 기반 | 어떤 속성 변경을 의미 있는 변경으로 볼지 |
| SRS-OPEN-006 | 랜덤순 세션 고정 | 세션 내 고정 후보 | 고정 여부와 seed 저장 여부 |
| SRS-OPEN-007 | 평가 되돌리기 | MVP 제외 | P1 포함 여부 |
| SRS-OPEN-008 | 칸반 보드 | P1 후보 | MVP 보조 화면 포함 여부 |
| SRS-OPEN-009 | 패키징 방식 | Windows 설치형 우선 후보 | portable 지원 여부 |
| SRS-OPEN-010 | FSRS 상태 스키마 | 라이브러리 상태 JSON + 버전 | 정확한 직렬화 형태 |

---

## 16. 참고 근거

본 SRS는 PRD v0.1을 기준으로 작성했으며, 구현 제약이 강한 항목은 다음 최신 공식/주요 문서를 참고했다.

1. Notion API — Query a data source: https://developers.notion.com/reference/query-a-data-source
2. Notion API — Retrieve a page: https://developers.notion.com/reference/retrieve-a-page
3. Notion API — Page object: https://developers.notion.com/reference/page
4. Notion API — Request limits: https://developers.notion.com/reference/request-limits
5. Electron Security: https://www.electronjs.org/docs/latest/tutorial/security
6. Electron Web Embeds: https://www.electronjs.org/docs/latest/tutorial/web-embeds/
7. Electron safeStorage: https://www.electronjs.org/docs/latest/api/safe-storage
8. ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs
9. better-sqlite3: https://github.com/WiseLibs/better-sqlite3

---

## 17. MVP 완료 정의

MVP는 다음 조건을 모두 만족할 때 완료로 본다.

1. 사용자가 Notion 토큰을 저장하고 연결 상태를 확인할 수 있다.
2. 사용자가 최소 1개 이상의 Review Source를 등록할 수 있다.
3. Source별 필드 매핑과 수집 기준을 저장할 수 있다.
4. 수동 동기화로 Notion 페이지가 Review Queue에 생성된다.
5. 여러 Source의 페이지가 하나의 Today Review 목록으로 표시된다.
6. 동일 Notion Page ID는 중복 생성되지 않는다.
7. 사용자가 Notion 페이지를 내부 뷰어 또는 외부 브라우저로 열 수 있다.
8. 사용자가 다시/어려움/보통/쉬움 평가를 저장할 수 있다.
9. 평가 후 Review Log와 FSRS 기반 next dueAt이 저장된다.
10. 변경된 페이지와 삭제/누락 후보 페이지를 별도 화면에서 확인할 수 있다.
11. 태그 없는 페이지는 `미분류`로 표시된다.
12. Notion 토큰과 민감 정보가 로그와 UI에 노출되지 않는다.
13. 주요 요구사항에 대한 단위/통합/인수 테스트가 통과한다.
