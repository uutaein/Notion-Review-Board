# language: ko
@mvp @missing-deleted-pages
기능: 누락, 삭제 및 동기화 오류 처리
  앱은 일시적 누락과 확정 삭제를 구분하고 사용자가 후속 조치를 할 수 있게 해야 한다.

  @SRS-FR-090
  시나리오: 조회되지 않은 페이지를 missing 후보로 처리한다
    조건 이전 동기화에 존재한 active Review Item이 있다
    만일 이번 동기화에서 해당 페이지가 조회되지 않는다
    그러면 항목은 즉시 deleted로 확정되지 않는다
    그리고 missing 상태로 표시된다
    그리고 Today Review에서 제외된다

  @SRS-FR-090
  시나리오: 누락된 페이지를 재발견해 복구한다
    조건 missing 상태의 Review Item이 있다
    만일 후속 동기화에서 같은 Notion Page ID가 다시 발견된다
    그러면 항목은 active 상태로 복구될 수 있다
    그리고 기존 Review Log는 유지된다

  @SRS-FR-091
  시나리오: 재확인 후 삭제를 확정한다
    조건 missing 상태의 Review Item이 있다
    만일 Page ID 재확인 또는 후속 동기화로 삭제가 확인된다
    그러면 항목 status는 deleted가 된다
    그리고 Today Review에서 제외된다
    그리고 기존 Review Log는 유지된다

  @SRS-FR-092
  시나리오: 삭제 및 누락 항목의 처리 방법을 제공한다
    조건 deleted 또는 missing 상태의 항목이 있다
    만일 사용자가 삭제된 페이지 화면을 연다
    그러면 제목과 Source와 Page ID와 마지막 정상 동기화 시각이 표시된다
    그리고 제거와 기록 보존과 무시와 다시 확인 선택지가 표시된다

  @SRS-FR-093
  시나리오 개요: 동기화 오류 유형을 구분한다
    조건 Source 동기화가 실패했다
    만일 오류 유형이 "<오류>"이다
    그러면 사용자가 다음 조치를 이해할 수 있는 "<안내>"가 표시된다
    그리고 토큰과 내부 stack trace는 표시되지 않는다

    예:
      | 오류          | 안내             |
      | 인증 오류     | 토큰 확인        |
      | 권한 오류     | Notion 공유 권한 확인 |
      | rate limit    | 잠시 후 재시도   |
      | 네트워크 오류 | 네트워크 연결 확인 |
      | 스키마 오류   | 필드 매핑 확인   |

