# 케이트블랑 드레스룸 · 고객 관리 대시보드

Supabase에 저장된 고객/시공 데이터를 시각화하는 사내 대시보드입니다.

🔗 **[대시보드 바로가기](https://rumanesystem.github.io/lumane_dashboard/)**

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| 프론트엔드 | HTML · CSS · JavaScript |
| 차트 | Chart.js (CDN) |
| 백엔드 | Supabase (PostgreSQL) |
| 배포 | GitHub Pages |

---

## 주요 기능

- **핵심 지표 6개** — 전체 고객, 진행 중, 시공 완료, 총 매출, 평균 견적, 계약 전환율
- **영업 분석** — 상태별 분포, 월간 현황, 계약 전환 퍼널
- **매출 분석** — 월별/일별 매출, 결제방법별 비율
- **마케팅 분석** — 상담채널별 유입, 채널별 월간 추이
- **운영 현황** — 월별 시공 추이, 설치구조별 분포, 시공기사별 담당
- **전역 월 필터** — 월 선택 시 KPI + 5개 차트 동시 연동

---

## 파일 구조

```
lumane_dashboard/
├── index.html   # 페이지 구조 및 차트 레이아웃
├── style.css    # 디자인, 색상, 반응형
└── script.js    # Supabase 연결, 데이터 가공, 차트 렌더링
```

---

## 데이터 구조

Supabase `customer` 스키마 사용

```
customer.customer      # 고객 원장
customer.install_view  # 시공 건 View 
```

---

## 로컬 실행

빌드 도구 없이 바로 실행 가능합니다.

```bash
# VS Code Live Server 확장 사용
index.html 우클릭 → Open with Live Server
```

> ⚠️ `file://` 직접 실행 시 CORS 오류 발생 — 반드시 로컬 서버로 실행

---



---

## 사내 사용 전용

이 저장소는 케이트블랑 드레스룸 사내 용도로 제작되었습니다.
