# language: ko
@mvp @synchronization
기능: Notion 수동 동기화
  사용자는 활성 Source를 동기화하고 처리 결과를 확인할 수 있어야 한다.

  @SRS-FR-040
  시나리오: 전체 활성 Source를 동기화한다
    조건 여러 개의 활성 Source가 등록되어 있다
    만일 사용자가 전체 동기화를 실행한다
    그러면 각 활성 Source의 진행 상태가 표시된다
    그리고 완료 후 생성과 갱신과 변경과 누락과 오류 개수가 표시된다

  @SRS-FR-040
  시나리오: 일부 Source 동기화가 실패한다
    조건 두 개 이상의 활성 Source가 등록되어 있다
    만일 한 Source는 성공하고 다른 Source는 실패한다
    그러면 성공한 Source의 결과는 저장된다
    그리고 실패한 Source에는 오류 상태가 표시된다

  @SRS-FR-041
  시나리오: 여러 페이지의 API 응답을 끝까지 조회한다
    조건 Notion API 응답에 다음 cursor가 있다
    만일 Source를 동기화한다
    그러면 다음 cursor가 없을 때까지 모든 응답을 조회한다
    그리고 같은 Notion Page ID는 한 번만 반영한다

  @SRS-FR-042
  시나리오: rate limit 이후 재시도한다
    조건 Notion API가 HTTP 429와 Retry-After를 반환한다
    만일 동기화가 진행 중이다
    그러면 앱은 Retry-After 이후 제한된 횟수만 재시도한다
    그리고 최종 실패하면 sync_error로 기록한다

  @SRS-FR-043
  시나리오: 처음 발견한 페이지를 생성한다
    조건 수집된 Notion Page ID가 로컬에 없다
    만일 동기화 결과를 반영한다
    그러면 active 상태의 Review Item이 생성된다
    그리고 최초 dueAt과 FSRS 초기 상태가 저장된다
    그리고 현재 Source가 sourceIds에 추가된다

  @SRS-FR-044
  시나리오: 기존 페이지를 중복 없이 갱신한다
    조건 같은 Notion Page ID의 Review Item이 존재한다
    만일 갱신된 페이지를 다시 동기화한다
    그러면 새 Review Item은 생성되지 않는다
    그리고 페이지 메타데이터와 마지막 동기화 시각이 갱신된다
    하지만 dueAt과 FSRS 상태와 Review Log는 변경되지 않는다

  @SRS-FR-045
  시나리오: 여러 Source의 같은 페이지를 병합한다
    조건 같은 Notion Page ID가 서로 다른 Source에서 수집된다
    만일 동기화 결과를 반영한다
    그러면 하나의 Review Item만 유지된다
    그리고 두 Source ID가 sourceIds에 보존된다

