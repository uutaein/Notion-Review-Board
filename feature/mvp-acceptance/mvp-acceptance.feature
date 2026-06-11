# language: ko
@mvp @end-to-end
기능: Notion Review Board MVP 인수
  사용자는 Notion 문서를 등록하고 통합 큐에서 복습한 뒤 다음 일정을 저장할 수 있어야 한다.

  시나리오: 하나의 Notion Source를 등록해 오늘 복습한다
    조건 사용자가 유효한 Notion 토큰을 저장했다
    만일 사용자가 Notion Source 하나를 등록하고 필드를 매핑한다
    그리고 수동 동기화를 실행한다
    그러면 수집된 active 문서가 Today Review에 표시된다

  시나리오: 구조가 다른 두 Source를 하나의 큐로 본다
    조건 사용자가 서로 다른 필드 구조의 Notion Source 두 개를 등록했다
    그리고 각 Source에 맞는 필드 매핑을 저장했다
    만일 전체 동기화를 실행한다
    그러면 두 Source의 Review Item이 하나의 Today Review에 표시된다
    그리고 같은 Notion Page ID는 중복 표시되지 않는다

  시나리오: 문서를 읽고 보통으로 평가한다
    조건 Today Review에 복습할 문서가 있다
    만일 사용자가 문서를 열고 "보통" 평가를 선택한다
    그러면 Review Log가 생성된다
    그리고 FSRS 기반 다음 복습일이 저장된다
    그리고 해당 문서는 오늘 목록에서 제거된다

  시나리오: 변경 또는 삭제 후보를 별도 처리한다
    조건 변경된 문서와 missing 문서가 각각 있다
    만일 사용자가 Today Review를 연다
    그러면 두 문서는 Today Review에 표시되지 않는다
    그리고 각각 변경된 페이지와 삭제된 페이지 화면에서 확인할 수 있다

  시나리오: 내부 뷰어 실패 시 외부 브라우저를 사용한다
    조건 허용된 Notion 문서가 내부 뷰어에서 열리지 않는다
    만일 사용자가 외부 브라우저로 열기를 선택한다
    그러면 검증된 Notion URL이 외부 브라우저에서 열린다

  @security
  시나리오: 전체 사용자 흐름에서 토큰을 노출하지 않는다
    조건 사용자가 Notion 토큰을 저장하고 동기화를 실행했다
    만일 화면과 로그와 Sync Event를 확인한다
    그러면 Notion 토큰 원문은 어디에도 표시되지 않는다

