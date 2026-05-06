# 트러블슈팅 내역

> 케이트블랑 드레스룸 고객 관리 대시보드  
> 작성일: 2026-05-04

---

## 1. 마케팅 분석 차트 빈 값 표시

**증상**  
상담채널별 유입, 채널별 월간 유입 차트가 데이터 없이 비어 있음

**원인**  
`inflow_type`, `inflow_date` 컬럼이 `customer` 테이블에 없고 `install` 테이블로 이동했는데, 차트 렌더 함수가 여전히 `_kpiCustomers`(customer 테이블 데이터) 기반으로 동작하고 있었음

**해결**  
- Supabase SQL Editor에서 `install_view`에 `inflow_type`, `inflow_date`, `next_consult_date` 3개 컬럼 추가
- `fetchCustomers()` 제거, `fetchInstalls()` 단일 호출로 통합
- 마케팅 차트 함수를 `_kpiInstalls` 기반으로 수정

---

## 2. 월별 필터 시 "진행 중" KPI 수치 오류

**증상**  
4월 필터 선택 시 진행 중이 63건이어야 하는데 4건으로 표시됨

**원인**  
`renderKPIsMonthly`에서 월 필터 기준을 `install_date`(시공 날짜)로 사용하고 있었음  
→ 4월에 시공 완료된 건(94건)을 추려 그 중 미완료(4건)만 카운트하는 잘못된 로직

**해결**  
필터 기준을 `install_date` → `inflow_date`(유입 날짜)로 변경  
→ 4월에 유입된 고객(84명) 중 비진행 상태 제외 → 63건으로 정상화

---

## 3. "진행 중" hover 툴팁 합계 불일치

**증상**  
툴팁 상태별 합계가 85건으로 표시되는데 KPI 카드에는 89건으로 표시됨

**원인**  
`status`가 null인 레코드(4건)를 `'상태미입력'`으로 처리했으나,  
`orderedStatuses` 배열에 `'상태미입력'`이 포함되지 않아 툴팁에서 누락됨

**해결**  
```javascript
const orderedStatuses = [...progressStatuses, '상태미입력'];
```
`'상태미입력'`을 배열 마지막에 명시적으로 추가 → 85건 → 89건으로 정상화

---

## 4. 전체 기간 전환 시 KPI 카드 미갱신

**증상**  
월별 필터 → 전체 기간으로 돌아올 때 KPI 카드 숫자가 갱신되지 않고 그대로 유지됨

**원인**  
필터 change 핸들러에 `renderKPIs(_kpiCustomers, _kpiInstalls)` 잔재 코드가 남아 있었음  
`_kpiCustomers`는 리팩토링 때 삭제된 변수라 `undefined`가 넘어가 함수가 정상 동작하지 않음

```javascript
// 문제 코드
renderKPIs(_kpiCustomers, _kpiInstalls);  // _kpiCustomers = undefined

// renderKPIs 함수 시그니처
function renderKPIs(installs) { ... }     // 인자 1개만 받음
```

**해결**  
```javascript
renderKPIs(_kpiInstalls);
```

---

## 5. Supabase SQL Editor Monaco 자동완성 오류

**증상**  
SQL Editor에서 키보드로 쿼리 입력 시 `AS\nSELECT`가 `asSELECT`로 합쳐지는 문법 오류 발생

**원인**  
Monaco 에디터의 자동완성(IntelliSense)이 개입해 입력 도중 텍스트를 임의로 수정

**해결**  
키보드 입력 대신 JavaScript로 에디터에 직접 값을 주입

```javascript
window.monaco.editor.getEditors()[0].setValue(`-- SQL 쿼리 전체 --`);
```

---

## 6. GitHub Pages 캐시로 인한 변경사항 미반영

**증상**  
코드 수정 후 push했는데 브라우저에서 변경사항이 반영되지 않음

**원인**  
브라우저가 이전 버전의 JS/CSS 파일을 캐시에서 불러옴  
(GitHub Pages 배포는 정상 완료된 상태)

**해결**  
`Ctrl + Shift + R` (강력 새로고침)으로 캐시 무시하고 재로드

---

## 7. 월별 필터 시 시공완료 건수·매출 기준 오류 (2026-05-06)

**증상**  
4월 필터 선택 시 시공완료 건수와 총 매출이 실제와 다르게 표시됨

**원인**  
`renderKPIsMonthly`에서 시공완료·매출 모두 `inflow_date` 기준으로 필터링하고 있었음  
→ "4월에 유입된 고객 중 이미 시공완료된 건"을 집계하므로, 유입 즉시 시공이 일어나지 않는 이상 거의 0에 수렴하거나 의미 없는 수치가 나옴

**해결**  
시공완료·매출 계산 기준을 `inflow_date` → `install_date`(실제 시공 완료일)로 변경

```javascript
// 수정 전: inflow_date 기준 (잘못됨)
const completedRows = newCustomers.filter(i => i.status === '시공완료');

// 수정 후: install_date 기준 (올바름)
const installMonth  = _kpiInstalls.filter(i => ymKey(i.install_date) === ym);
const completedRows = installMonth.filter(i => i.status === '시공완료');
```

---

## 8. 월별 필터 시 "진행 중" KPI와 툴팁 합계 불일치 (2026-05-06)

**증상**  
신규 유입 7명인데 진행 중 카드에 18건 표시, 툴팁 합계는 7건으로 불일치

**원인**  
- KPI 카드(진행 중): `install_date` 기준으로 계산 → 18건
- 툴팁: `inflow_date` 기준(`newCustomers`)으로 계산 → 7건  
두 값이 서로 다른 기준을 사용해 불일치 발생

**해결**  
진행 중 KPI를 `inflow_date` 기준(그 달 유입 고객 중 현재 진행 중인 건)으로 통일

```javascript
// 진행 중: inflow_date 기준
const inProgress = newCustomers.filter(i => !NON_PROGRESS.has(i.status || '')).length;
```

---

## 9. 툴팁 STATUS_ORDER 외 status 누락 (2026-05-06)

**증상**  
5월 필터 시 진행 중 7건인데 툴팁에 가망고객 4건 + 계약완료 2건 = 6건만 표시, 1건 누락

**원인**  
툴팁 렌더가 `STATUS_ORDER`에 정의된 고정 목록(`orderedStatuses`)만 순회하도록 되어 있어,  
DB에 목록 밖의 status값이 존재하면 합계에는 더해지지만 행에는 표시되지 않음

**해결**  
`statusCount`에 있지만 `orderedStatuses`에 없는 항목을 `extraStatuses`로 추출해 함께 표시

```javascript
const orderedStatuses = [...progressStatuses, '상태미입력'];
const extraStatuses   = Object.keys(statusCount).filter(s => !orderedStatuses.includes(s));
const allStatuses     = [...orderedStatuses, ...extraStatuses];
const rows = allStatuses.filter(s => statusCount[s] > 0).map(...);
```
