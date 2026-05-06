---
name: context_project
description: 프로젝트 문서 요약 — 계획서, 맥락, 체크리스트 (읽은 날짜: 2026-05-04) / DB 스키마 최신화: 2026-05-06
type: project
---

**읽은 파일들**:
- `./README.md` — 케이트블랑 드레스룸 고객 관리 대시보드, Supabase + GitHub Pages
- `./01_대시보드_계획서.docx` — 5섹션 16차트 구성, 기술 스택·디자인 가이드·보안 설정
- `./02_맥락_노트.docx` — DB 스키마 상세, 데이터 특성·통계, 개발자 컨텍스트, 주의사항
- `./03_체크리스트.docx` — Phase 1~5 단계별 실행 체크리스트 + 트러블슈팅

**Why**: 대화 재개 시 프로젝트 컨텍스트를 자동으로 불러오기 위해
**How to apply**: 이 프로젝트 관련 작업 요청 시 참고

---

## 목표 및 현재 상태

**프로젝트**: 케이트블랑 드레스룸 사내 고객 관리 대시보드
**배포 중**: https://rumanesystem.github.io/lumane_dashboard/
**스택**: HTML · CSS · JS (빌드 없음) + Chart.js CDN + Supabase + GitHub Pages

---

## DB 스키마 (2026-05-04 Supabase 실측 기준)

**customer.customer** (고객 원장)
- `name`, `phone`(PK) — phone: 일반번호 / `@인스타ID` / `@no_contact_NNNN` 3형식 혼재
- `saved_at`, `last_changed_at`

**customer.install** (시공 메인 테이블 — RLS 활성화, anon 직접 읽기 불가, 실데이터 보유, 35개 컬럼 / ordinal 최대 45, 중간 삭제로 gap 존재)

| 카테고리 | 컬럼 |
|----------|------|
| 기본 식별 | `install_id`, `name`, `phone` |
| 상태·일정 | `status`(9단계), `desired_install_date`, `install_date` |
| 위치 | `address`, `location` |
| 현장 정보 | `is_room_empty`, `install_location`, `install_type`(자유입력) |
| 치수 | `height_ceiling`, `height_curtain_box`, `side_a`~`side_e` |
| 시공 옵션 | `options`, `ceiling_structure`, `color_frame`, `color_shelf` |
| 견적·결제 | `quote_amount`, `pay_type`, `installer` |
| 파일링크 | `file_quote`, `file_room_photo`, `file_layout`, `file_floor_plan`, `file_install_photo`, `file_final_form_biz`, `file_final_form_customer` |
| 메모·시각 | `notes`, `saved_at`, `last_changed_at` |
| 연동·유입 | `notion_page_id`, `inflow_type`, `inflow_date`, `next_consult_date` |

> ⚠️ 2026-05-06 삭제된 컬럼: `region`, `address_detail`, `has_quote`, `has_room_photo`, `has_layout`, `has_floor_plan` (has_ 불리언 4개)

**customer.install_view** (시공 View — UNRESTRICTED, anon 읽기 가능, 39개 컬럼)
- `install` 테이블 기반 뷰, ordinal gap 없이 1~39 순차 배열
- `has_*` 계산 컬럼 제거됨, `notion_page_id` 포함으로 변경
- 현재 대시보드는 이 뷰를 통해 데이터 로드 (`fetchInstalls()` → `install_view`)

**status 9단계**: 상담전 → 가능고객 → 가망고객 → 견적발송 → 시공일미정 → 계약완료 → 시공완료 (+ 상담종료·반응무)

---

## 코드-스키마 상태 (2026-05-06 기준 — 정상)

- 데이터 소스: `install_view` 단일 (`fetchInstalls()`)
- 삭제된 컬럼(`region`, `address_detail`, `has_*`)은 대시보드 코드에서 미사용 → 영향 없음
- `notion_page_id` 뷰에 추가됐으나 대시보드에서 미사용 → 영향 없음

---

## 대시보드 구성 (5섹션)

| 섹션 | 내용 |
|------|------|
| KPI 카드 (6개) | 전체 고객·진행 중·시공 완료·총 매출·평균 견적·계약 전환율 |
| 영업 분석 (3개) | 상태별 분포·월간 현황·계약 전환 퍼널 |
| 매출 분석 (3개) | 월별·일별 매출, 결제방법별 비율 |
| 마케팅 분석 (2개) | 채널별 유입, 채널별 월간 추이 |
| 운영 현황 (3개) | 월별 시공 추이, 설치구조별·시공기사별 분포 |

---

## 데이터 통계

- 시공완료 114건(54%), 계약완료 25건, 가능고객 20건
- 채널: 카카오톡-케이트 135건(64%), 인스타그램 51건(24%)
- 결제: 스마트스토어 66건, 현금영수증 29건
- NULL 비율: install_date ~40%, quote_amount ~43%, installer ~45%

---

## 핵심 주의사항

- **`supabase.schema('customer').from(...)` 필수** — 기본 public 스키마라 빠뜨리면 데이터 없음
- **service_role 키 절대 금지** — anon 키만 사용
- **로컬 실행 시 Live Server 필수** — `file://` 직접 실행 시 CORS 오류
- install_type 자유 입력 (복합형 있음), side_a~e는 메모 섞인 TEXT
- NULL 처리 필수 (0 또는 '미정'으로 표시)

---

## 디자인 컬러

| 용도 | HEX |
|------|-----|
| 차트 메인 | `#185FA5` (네이비) |
| 차트 보조 | `#1D9E75` (틸) |
| 강조 | `#BA7517` (앰버) |
| 카드 배경 | `#F8F9FA` |

---

## 체크리스트 현황 (Phase 1~5)

Phase 1 (Supabase 권한·연결·폴더 준비) / Phase 2 (Step 1~12 단계별 개발)
Phase 3 (기본 동작·데이터·디자인·반응형·에러 확인)
Phase 4 (트러블슈팅: 연결 실패·데이터 없음·차트 미표시·한글 깨짐·CORS)
Phase 5 (코드 정리·파일 정리·백업) + 향후 개선 아이디어 (자동 새로고침·기간 필터·CSV 다운로드 등)
