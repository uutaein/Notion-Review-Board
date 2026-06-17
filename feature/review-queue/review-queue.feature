# language: ko
@mvp @review-queue
기능: 전체 Review Queue 확인
  사용자는 Today Review와 별도로 전체 active 큐를 확인할 수 있어야 한다.

  @SRS-FR-046
  시나리오: 미래 일정까지 포함한 active 큐를 표시한다
    조건 active Review Item에 오늘 dueAt과 미래 dueAt 항목이 있다
    그리고 changed, missing, archived 항목이 함께 있다
    만일 사용자가 "전체 큐"를 연다
    그러면 active 항목만 dueAt 오름차순으로 표시된다
    그리고 미래 dueAt 항목도 표시된다

  @SRS-FR-045 @SRS-FR-046
  시나리오: 병합된 Source 참조를 확인한다
    조건 같은 Notion Page ID가 두 Source에서 수집된 active Review Item이 있다
    만일 사용자가 "전체 큐"에서 해당 항목을 선택한다
    그러면 하나의 Review Item만 표시된다
    그리고 연결된 Source 정보를 확인할 수 있다
