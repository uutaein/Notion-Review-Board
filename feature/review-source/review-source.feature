# language: ko
@mvp @review-source
기능: Review Source 관리
  사용자는 복습할 Notion 데이터 소스를 등록하고 관리할 수 있어야 한다.

  @SRS-FR-010
  시나리오: 필수 정보를 입력해 Source를 등록한다
    조건 등록된 Review Source가 없다
    만일 사용자가 소스 이름과 Notion 대상과 수집 방식과 제목 매핑을 입력한다
    그리고 활성 상태로 Source를 저장한다
    그러면 새 Review Source가 목록에 표시된다

  @SRS-FR-010
  시나리오 개요: 필수값이 없는 Source는 저장하지 않는다
    조건 사용자가 Source 등록 화면을 열었다
    만일 "<필수값>"을 입력하지 않고 저장한다
    그러면 Source는 저장되지 않는다
    그리고 누락된 "<필수값>" 안내가 표시된다

    예:
      | 필수값        |
      | 소스 이름     |
      | Notion 대상   |
      | 수집 방식     |
      | 제목 속성 매핑 |

  @SRS-FR-010
  시나리오: 같은 Notion 대상을 중복 등록한다
    조건 동일한 Notion 대상이 이미 등록되어 있다
    만일 사용자가 같은 대상을 새 Source로 저장한다
    그러면 중복 Source 경고가 표시된다

  @SRS-FR-011
  시나리오: Source 설정을 수정한다
    조건 Review Source와 해당 Source의 Review Log가 존재한다
    만일 사용자가 수집 방식과 필드 매핑을 수정한다
    그러면 다음 동기화부터 변경된 기준이 적용된다
    그리고 기존 Review Log는 유지된다

  @SRS-FR-012
  시나리오: 여러 Source가 공유하는 항목을 보존한다
    조건 하나의 Review Item이 두 개의 Source에서 참조된다
    만일 사용자가 그중 하나의 Source를 삭제한다
    그러면 삭제 영향 범위와 항목 처리 선택지가 표시된다
    그리고 다른 Source의 Review Item 참조는 유지된다
    그리고 기존 Review Log는 유지된다

  @SRS-FR-013
  시나리오: 비활성 Source를 동기화에서 제외한다
    조건 활성 Source와 비활성 Source가 각각 존재한다
    만일 사용자가 전체 동기화를 실행한다
    그러면 활성 Source만 동기화된다
    그리고 비활성 Source의 기존 Review Item은 삭제되지 않는다

