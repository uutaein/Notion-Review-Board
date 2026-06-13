# language: ko
@mvp @synchronization
기능: Notion 수동 동기화
  사용자는 활성 Source 전체 또는 하나를 수동 동기화하고,
  Collection Engine과 Review Queue 반영 결과를 확인할 수 있어야 한다.

  @SRS-FR-040
  시나리오: 전체 활성 Source를 동기화한다
    조건 활성 Source와 비활성 Source가 등록되어 있다
    만일 사용자가 전체 동기화를 실행한다
    그러면 활성 Source만 동기화된다
    그리고 각 활성 Source의 진행 상태가 표시된다
    그리고 완료 후 생성과 갱신과 변경과 누락과 오류 개수가 표시된다

  @SRS-FR-040
  시나리오: 단일 활성 Source를 동기화한다
    조건 여러 개의 활성 Source가 등록되어 있다
    만일 사용자가 하나의 Source에서 동기화를 실행한다
    그러면 선택한 Source만 동기화된다
    그리고 선택하지 않은 Source의 마지막 동기화 상태는 변경되지 않는다

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

  @SRS-FR-041
  시나리오: pagination 중간 오류를 Source 오류로 기록한다
    조건 Notion API 응답에 다음 cursor가 있다
    만일 다음 페이지를 조회하는 중 오류가 발생한다
    그러면 해당 Source의 동기화는 오류로 기록된다
    그리고 다른 Source의 성공 결과는 유지된다

  @SRS-FR-042
  시나리오: rate limit 이후 재시도한다
    조건 Notion API가 HTTP 429와 Retry-After를 반환한다
    만일 동기화가 진행 중이다
    그러면 앱은 Retry-After 이후 제한된 횟수만 재시도한다
    그리고 최종 실패하면 sync_error로 기록한다

  @SRS-FR-042
  시나리오: rate limit 대기 중 동기화를 취소한다
    조건 Notion API rate limit으로 재시도를 기다리고 있다
    만일 사용자가 동기화를 취소한다
    그러면 추가 Notion API 조회를 시작하지 않는다
    그리고 동기화가 취소되었음이 표시된다

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

  @SRS-FR-044
  시나리오: 변경 감지 대상은 기존 복습 일정을 유지한다
    조건 같은 Notion Page ID의 active Review Item이 존재한다
    그리고 Notion 수정 시각이 마지막 동기화 이후로 변경되었다
    만일 갱신된 페이지를 다시 동기화한다
    그러면 해당 항목은 변경 감지 결과에 포함된다
    하지만 dueAt과 FSRS 상태와 Review Log는 변경되지 않는다

  @SRS-FR-045
  시나리오: 여러 Source의 같은 페이지를 병합한다
    조건 같은 Notion Page ID가 서로 다른 Source에서 수집된다
    만일 동기화 결과를 반영한다
    그러면 하나의 Review Item만 유지된다
    그리고 두 Source ID가 sourceIds에 보존된다
    그리고 최초 수집 Source가 primarySourceId로 유지된다

  @SRS-FR-045
  시나리오 개요: Page ID가 다르면 자동 병합하지 않는다
    조건 서로 다른 Notion Page ID의 두 페이지가 있다
    그리고 두 페이지의 "<동일 값>"이 같다
    만일 동기화 결과를 반영한다
    그러면 두 개의 Review Item이 유지된다

    예:
      | 동일 값 |
      | URL     |
      | 제목    |

