# language: ko
@mvp @today-review
기능: 오늘의 복습 목록
  사용자는 오늘까지 복습할 active 문서를 정렬하고 필터링해 볼 수 있어야 한다.

  배경:
    조건 사용자 로컬 날짜가 "2026-06-11"이다

  @SRS-FR-050
  시나리오: 오늘 복습할 active 항목만 표시한다
    조건 dueAt이 오늘 이전인 active 항목이 있다
    그리고 dueAt이 미래인 active 항목이 있다
    그리고 dueAt이 오늘 이전인 changed 항목이 있다
    만일 Today Review를 연다
    그러면 dueAt이 오늘 이전인 active 항목만 표시된다

  @SRS-FR-050
  시나리오: 오늘 복습 목록이 비어 있다
    조건 Today Review 조건에 맞는 항목이 없다
    만일 Today Review를 연다
    그러면 복습 완료 또는 동기화 안내가 표시된다

  @SRS-FR-051
  시나리오: 복습 항목의 필수 정보를 표시한다
    조건 Today Review 대상 항목이 있다
    만일 항목이 목록에 표시된다
    그러면 제목과 Source와 분류와 dueAt과 상태가 표시된다
    그리고 문서 열기와 4단계 평가 버튼이 표시된다

  @SRS-FR-052
  시나리오: 오래 밀린 항목부터 날짜순으로 표시한다
    조건 dueAt이 서로 다른 Today Review 항목들이 있다
    만일 사용자가 날짜순 보기를 선택한다
    그러면 dueAt 오름차순으로 표시된다
    그리고 현재 정렬 기준이 화면에 표시된다

  @SRS-FR-053
  시나리오: Today Review 범위 안에서만 무작위로 섞는다
    조건 Today Review 대상과 대상이 아닌 항목이 함께 있다
    만일 사용자가 랜덤순 보기를 선택한다
    그러면 Today Review 대상 항목만 무작위 순서로 표시된다

  @SRS-FR-054
  시나리오: 미분류 항목을 필터링한다
    조건 분류나 태그가 없는 Today Review 항목이 있다
    만일 사용자가 "미분류" 필터를 선택한다
    그러면 해당 항목이 필터 결과에 표시된다
    그리고 dueAt과 active 상태 조건은 유지된다

