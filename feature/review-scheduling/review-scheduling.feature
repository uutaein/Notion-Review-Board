# language: ko
@mvp @review-scheduling @fsrs
기능: 4단계 복습 평가와 FSRS 일정 계산
  사용자는 문서를 평가하고 다음 복습 일정을 안전하게 갱신할 수 있어야 한다.

  @SRS-FR-070
  시나리오 개요: 한국어 평가를 FSRS 값에 매핑한다
    조건 사용자가 복습 문서를 열었다
    만일 사용자가 "<평가>" 버튼을 누른다
    그러면 내부 평가 값은 "<내부값>"으로 처리된다
    그리고 FSRS 평가는 "<FSRS값>"으로 처리된다

    예:
      | 평가   | 내부값 | FSRS값 |
      | 다시   | again  | Again  |
      | 어려움 | hard   | Hard   |
      | 보통   | good   | Good   |
      | 쉬움   | easy   | Easy   |

  @SRS-FR-070 @accessibility
  시나리오: 드래그 없이 버튼으로 평가한다
    조건 사용자가 Today Review 또는 문서 뷰어에 있다
    만일 사용자가 충분한 크기의 평가 버튼을 누른다
    그러면 드래그 앤 드롭 없이 평가가 제출된다

  @SRS-FR-071
  시나리오: 평가 결과를 원자적으로 저장한다
    조건 Today Review 대상 항목이 있다
    만일 사용자가 "보통"으로 평가한다
    그러면 Review Log가 정확히 한 번 생성된다
    그리고 FSRS 상태와 dueAt과 lastReviewedAt이 함께 갱신된다
    그리고 완료 항목은 현재 Today Review에서 제거된다

  @SRS-FR-071
  시나리오: 평가 저장 중 실패하면 부분 갱신하지 않는다
    조건 Today Review 대상 항목이 있다
    만일 평가 저장 트랜잭션 중 오류가 발생한다
    그러면 Review Log와 Review Item 변경이 모두 취소된다
    그리고 사용자는 저장 실패 안내를 받는다

  @SRS-FR-071
  시나리오: 같은 평가를 중복 제출하지 않는다
    조건 사용자가 한 항목의 평가 버튼을 눌렀다
    만일 첫 번째 평가 저장이 진행 중이다
    그러면 해당 항목의 평가 버튼은 다시 제출할 수 없다

  @SRS-FR-072
  시나리오: 버전이 포함된 FSRS 상태를 기록한다
    조건 Review Item의 평가가 성공했다
    그러면 Review Item에 dueAt 이외의 FSRS 상태가 저장된다
    그리고 Review Log에 평가 전후 FSRS 상태가 저장된다
    그리고 FSRS 상태 버전이 저장된다

