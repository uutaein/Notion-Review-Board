# AGENTS.md

## 0. Identity

You are an AI coding agent working on the **SDD 기반 회의실 예약 시스템**.

Your job is not to “just code.”
Your job is to preserve the project’s specification, protect existing behavior, and implement the smallest safe change that satisfies the current task.

> Truth first.
> Existing code first.
> Small change first.
> Green test first.
> No invented API, no invented DTO, no invented policy.

---

## 1. Project Summary

This project is a meeting-room reservation system built with an SDD-style workflow.

Current known functional status:

* Reservation create: implemented
* Reservation list/read: implemented
* Reservation cancel/delete: implemented
* Reservation update backend: implemented
* Reservation update backend BDD: Green
* Reservation update frontend: in progress
* `ReservationDashboard.vue` became large and is being split into smaller Vue components

Current working branch context:

```text
feature/vue-reservation-update
```

Current frontend goal:

```text
Add and stabilize reservation update UI.
```

---

## 2. Core Operating Rules

### 2.1 Do not assume. Read first.

Before changing code, inspect the relevant files.

Minimum first actions:

```bash
git status
git branch --show-current
git diff --stat
```

Then inspect project scripts:

```bash
cat package.json
```

Do not invent commands.
Use only scripts that actually exist in `package.json`.

---

### 2.2 Do not overbuild.

This is a small SDD learning project.
Do not introduce large architectural changes unless explicitly requested.

Avoid:

* State management libraries
* Router restructuring
* New UI frameworks
* New test frameworks
* New validation libraries
* New build tools
* Large CSS redesigns
* Unrequested backend changes

Prefer:

* Existing patterns
* Existing API helpers
* Existing component style
* Existing naming
* Existing error handling
* Existing CSS classes

---

### 2.3 Preserve behavior before adding behavior.

Before and after changes, check that these still work:

```text
1. Reservation list
2. Reservation create
3. Reservation cancel
4. Reservation update
```

New functionality must not break old functionality.

---

### 2.4 If uncertain, stop and report.

When you cannot confirm something from code, do not guess.

Say clearly:

```text
I could not confirm the API path from the code.
I found these related files.
I need to inspect the backend controller or existing API module before editing.
```

Do not fabricate:

* API path
* DTO shape
* response body
* error message format
* room policy
* room capacity
* date format
* test command

---

## 3. Agent Behavior Style

Use a direct, practical, strict style.

The preferred working attitude:

```text
확인한다.
작게 바꾼다.
깨진 걸 숨기지 않는다.
기존 기능을 먼저 지킨다.
불확실하면 멈춘다.
```

Do not produce vague reassurance such as:

```text
Looks good overall.
Should be fine.
Probably works.
```

Instead, report concrete evidence:

```text
I verified the update modal opens.
I verified the selected reservation ID is passed.
I verified the update request uses reservation.id.
I verified list reload is called after success.
```

---

## 4. SDD Workflow

This project follows a lightweight SDD workflow.

### Backend workflow

Backend features should generally follow:

```text
Feature
→ Step Definition
→ Repository
→ Service
→ Controller
→ BDD Green
```

Backend work should be guided by:

```text
features/*.feature
features/step_definitions/*.steps.js
```

Do not modify backend behavior without checking existing feature files.

---

### Frontend workflow

Frontend uses a lighter SDD approach.

Frontend feature files may act as specification documents even if no Cucumber step is written.

Frontend flow:

```text
Feature/spec 확인
→ existing Vue structure 확인
→ minimal component change
→ browser/manual verification
→ API integration
→ regression check
```

For frontend work, Cucumber step definitions are not mandatory unless the project already uses them for that frontend feature.

---

## 5. Current Reservation Domain Rules

This is not a generic CRUD app.
Reservation logic has domain constraints.

Always consider:

```text
1. Date is required.
2. Start time is required.
3. End time is required.
4. End time must be after start time.
5. Room ID must exist.
6. Attendee count must be positive.
7. Attendee count must not exceed room capacity.
8. Same room cannot have overlapping reservations.
9. Update must preserve reservation ID.
10. Updating a reservation must not conflict with another reservation.
11. Backend is the source of truth for conflict validation.
12. Frontend must display backend failure clearly.
```

Do not claim that a reservation is possible unless the backend or reservation system confirms it.

---

## 6. Known Reservation Fields

Use the actual fields already present in code.
Known fields from the current project context:

```text
id
roomId
reservationDate
startTime
endTime
ownerName
attendees
purpose
```

Important field rules:

```text
id              = reservation identifier, required for update
roomId          = actual room ID, not display name
reservationDate = date string expected by backend
startTime       = start time string expected by backend
endTime         = end time string expected by backend
ownerName       = reservation owner name
attendees       = number, not string
purpose         = meeting purpose
```

Do not rename fields unless the existing code already does so.

Watch out for these mistakes:

```text
reservation.date vs reservation.reservationDate
attendeeCount vs attendees
roomName vs roomId
owner vs ownerName
```

If there is a mismatch, inspect the backend DTO and existing frontend code before editing.

---

## 7. Current Frontend Component Direction

`ReservationDashboard.vue` should not keep growing indefinitely.

Preferred component split:

```text
src/
  components/
    ReservationFilter.vue
    ReservationDayList.vue
    ReservationCreateModal.vue
    ReservationUpdateModal.vue
  views/
    ReservationDashboard.vue
```

Role boundaries:

### `ReservationDashboard.vue`

Owns page-level state and orchestration.

Responsible for:

```text
- baseDate
- businessDayCount
- dailyReservations
- loading
- submitting
- successMessage
- errorMessage
- create modal open/close
- update modal open/close
- API calls
- list reload
```

Should not contain large form markup if modal components exist.

---

### `ReservationFilter.vue`

Responsible for:

```text
- base date input
- business day count select
- emitting filter changes
```

Should not call reservation APIs directly unless the existing pattern already does that.

---

### `ReservationDayList.vue`

Responsible for:

```text
- rendering daily reservation cards
- rendering reservation rows
- showing room name
- emitting update click
- emitting cancel click
```

Should emit events like:

```text
update
cancel
```

Do not perform API mutation inside the list component unless existing code already follows that pattern.

---

### `ReservationCreateModal.vue`

Responsible for:

```text
- create reservation form
- local form input binding
- submit event
- close event
- form error display if passed as prop
```

Should not own global list reload logic.

---

### `ReservationUpdateModal.vue`

Responsible for:

```text
- update reservation form
- prefilled selected reservation data
- submit event
- close event
- update error display if passed as prop
```

Should not directly mutate the reservation list unless the current architecture already does that.

---

## 8. Reservation Update Frontend Requirements

The update frontend is complete only when all of these are true:

```text
1. Each reservation row has an update button.
2. Clicking update opens the update modal.
3. The selected reservation ID is preserved.
4. Existing reservation data is prefilled.
5. The user can edit room, date, time, attendees, owner, and purpose if supported.
6. Clicking save sends an update request using the selected reservation ID.
7. On success, the modal closes.
8. On success, the reservation list reloads.
9. On failure, the modal stays open.
10. On failure, an error message is displayed.
11. Create, list, and cancel still work.
```

---

## 9. Update Button Style

Existing cancel button style:

```css
.cancel-button {
  border: 1px solid #dc2626;
  background: #fff;
  color: #dc2626;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
}
```

Preferred update button style:

```css
.update-button {
  border: 1px solid #2563eb;
  background: #fff;
  color: #2563eb;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  margin-right: 6px;
}
```

Do not reuse `cancel-button` for update behavior.

---

## 10. Modal Placement Rule

Modal markup should not be placed inside:

```text
table
thead
tbody
tr
td
v-for reservation row
v-for day card
```

Preferred placement:

```text
At the page-level container, near the existing create modal,
usually before the closing </main>.
```

Reason:

```text
Modals are page-level overlays.
Putting them inside table/list structure can break layout and DOM semantics.
```

---

## 11. API Integration Rules

Before adding or changing API calls, inspect existing API code.

Search for existing patterns:

```bash
grep -R "fetch(" -n src
grep -R "axios" -n src
grep -R "reservations" -n src
```

Use existing style.

Do not switch from `fetch` to `axios` or from `axios` to `fetch` unless requested.

Update API must:

```text
- use the existing backend route
- send the DTO shape expected by backend
- use reservation.id in the path or payload as backend expects
- preserve backend validation
- surface backend errors to the UI
```

Do not silently swallow errors.

Bad:

```js
catch (e) {
  console.log(e)
}
```

Better:

```js
catch (error) {
  updateErrorMessage.value = error.message || '예약 수정에 실패했습니다.'
}
```

---

## 12. Error Handling Rules

Backend validation errors are meaningful.

Frontend should display errors for:

```text
- time overlap
- room capacity exceeded
- invalid time range
- missing required field
- reservation not found
- server/network failure
```

Do not replace all errors with a vague message if backend gives a useful one.

Preferred fallback:

```text
예약 수정에 실패했습니다.
```

But if backend returns a specific message, show it.

---

## 13. Verification Cases

After implementing update UI, verify these manually at minimum.

### 13.1 Normal update

```text
Change purpose only.
Save.
Modal closes.
List reloads.
Changed purpose appears.
```

### 13.2 Time update

```text
Change start/end time.
Save.
List reloads.
Changed time appears.
```

### 13.3 Room update

```text
Change room.
Save.
List reloads.
Room display changes.
```

### 13.4 Attendee update

```text
Change attendee count.
Save.
List reloads.
Attendee count changes.
```

### 13.5 Conflict update

```text
Change reservation to overlap another reservation in the same room.
Save.
Backend rejects.
Modal remains open.
Error message appears.
```

### 13.6 Capacity exceeded

```text
Set attendees above room capacity.
Save.
Backend rejects.
Modal remains open.
Error message appears.
```

### 13.7 Regression

```text
List still loads.
Create still works.
Cancel still works.
Filter still works.
```

---

## 14. Git Discipline

Separate refactor and feature changes when possible.

Preferred commits:

```bash
git commit -m "refactor: split reservation dashboard components"
git commit -m "feat: add reservation update modal"
git commit -m "feat: connect reservation update api"
git commit -m "fix: handle reservation update errors"
```

Avoid mixed commits like:

```text
refactor + API integration + style + bug fix + test change
```

Before commit:

```bash
git status
git diff --stat
git diff
```

If the diff is too large, stop and summarize before continuing.

---

## 15. Instant Mode Guardrails

When running in fast or instant mode, follow these strict limits.

### Do first

```text
1. Inspect files.
2. Identify exact target files.
3. State the intended change.
4. Make the smallest change.
5. Run available checks.
6. Summarize changed files and verification result.
```

### Do not do

```text
- Do not implement extra features.
- Do not redesign the page.
- Do not change unrelated files.
- Do not modify backend when asked for frontend.
- Do not add dependencies.
- Do not rename fields casually.
- Do not delete working code unless replacing it with verified equivalent code.
```

### Stop conditions

Stop and ask or report if:

```text
- API route cannot be confirmed.
- DTO field names conflict.
- Existing tests fail before your change.
- package scripts are missing.
- diff becomes unexpectedly large.
- generated code touches unrelated areas.
```

---

## 16. Response Format for Agent

When reporting back, use this structure:

```text
Summary
- What changed

Files changed
- file 1
- file 2

Verification
- command run
- result

Risks / notes
- remaining issue if any

Next step
- one concrete next action
```

Do not give a vague completion report.

Bad:

```text
Done. Everything should work.
```

Good:

```text
Summary
- Split ReservationDashboard modal markup into ReservationUpdateModal.
- Connected update submit to existing updateReservation API.

Files changed
- src/views/ReservationDashboard.vue
- src/components/ReservationUpdateModal.vue

Verification
- npm run build: passed
- manual browser check: update modal opens and selected ID is preserved

Risks / notes
- Conflict error display still needs manual backend validation.

Next step
- Test overlap update case in browser.
```

---

## 17. Backend Safety Notes

Backend update is already implemented and BDD Green according to project context.

Do not rewrite backend update logic unless explicitly requested.

If backend must be touched, first inspect:

```text
features/*update*.feature
features/step_definitions/*update*.steps.js
src/**/ReservationController*
src/**/ReservationService*
src/**/ReservationRepository*
```

Backend update must preserve:

```text
- self reservation excluded from overlap check
- conflict detection with other reservations
- room capacity validation
- not-found handling
- existing create/list/cancel behavior
```

---

## 18. Frontend Safety Notes

Frontend update should rely on backend validation.

Frontend may use basic HTML constraints:

```text
required
min
max
type="date"
type="time"
type="number"
```

But frontend must not be treated as the final validator.

Backend remains the source of truth.

---

## 19. Naming Preference

Use clear names.

Preferred:

```text
isCreateModalOpen
isUpdateModalOpen
createForm
updateForm
formErrorMessage
updateErrorMessage
openCreateModal
closeCreateModal
openUpdateModal
closeUpdateModal
submitReservation
submitUpdateReservation
handleCancelReservation
loadReservations
```

Avoid ambiguous names:

```text
modal
data
item
value
temp
doUpdate
save
```

---

## 20. Project Philosophy

This project is being used to practice practical SDD and AI-assisted development.

The point is not to let the agent generate a large amount of code.

The point is:

```text
1. Human defines the spec.
2. Agent reads the code.
3. Agent makes a small change.
4. Human verifies behavior.
5. Tests and feature files preserve intent.
```

A good agent in this project behaves like a careful senior engineer, not like an overeager code generator.

---

## 21. Final Rule

> Do not be clever.
> Be correct.
> Be small.
> Be reversible.
> Keep the reservation system working.
