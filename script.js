/* ===========================================================
   케이트블랑 드레스룸 · 고객 관리 대시보드
   - Supabase customer 스키마에서 데이터 로드
   - Chart.js로 17개 요소 렌더링
   - 전역 월 필터: 5개 차트 연동
   =========================================================== */

// ===== Supabase 연결 정보 =====
const SUPABASE_URL = 'https://rvhjztpddkfnfytkbuca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2aGp6dHBkZGtmbmZ5dGtidWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTE0OTcsImV4cCI6MjA5MTA4NzQ5N30._boEK0iqvN9d8yjdgv7WpcTF0jIUC-hhXSOYrwFu9fA';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 색상 팔레트 =====
const COLORS = {
  main:    '#185FA5',
  sec:     '#1D9E75',
  accent:  '#BA7517',
  palette: ['#185FA5', '#1D9E75', '#BA7517', '#5B8DC9', '#5BB89B', '#D9A05B', '#8DA6C2', '#A8D0C2'],
  grid:    '#E9ECEF',
  text:    '#6C757D'
};

// 9단계 영업 파이프라인
const STATUS_ORDER = ['상담전','상담종료','반응무','가능고객','가망고객','견적발송','시공일미정','계약완료','시공완료'];
const FUNNEL_ORDER = ['상담전','가능고객','가망고객','견적발송','계약완료','시공완료'];
const NON_PROGRESS = new Set(['시공완료','상담종료','반응무']);

// ===== 전역 상태 =====
const charts = {};
let _kpiInstalls = [];
let globalMonth  = ''; // '' = 전체

// ===== Chart.js 기본 설정 =====
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = COLORS.text;

function baseOpts(extra = {}) {
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, padding: 10 } }
    }
  }, extra);
}

// ===== 유틸 =====
const fmt = {
  num: n => (n ?? 0).toLocaleString('ko-KR'),
  won: n => (n ?? 0).toLocaleString('ko-KR'),
  wonShort(n) {
    n = n ?? 0;
    if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
    if (n >= 1e4) return Math.round(n / 1e4).toLocaleString('ko-KR') + '만';
    return n.toLocaleString('ko-KR');
  },
  pct: n => (n ?? 0).toFixed(1) + '%'
};

function ymKey(dateStr) {
  if (!dateStr) return null;
  return String(dateStr).slice(0, 7);
}
function ymdKey(dateStr) {
  if (!dateStr) return null;
  return String(dateStr).slice(0, 10);
}
function lastNMonths(n) {
  const arr = [], now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return arr;
}
function lastNDays(n) {
  const arr = [], now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    arr.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  return arr;
}

// ===== 데이터 로드 =====
// install_view = install 테이블 기반 뷰 (inflow_type, inflow_date, next_consult_date 포함)
async function fetchInstalls() {
  const { data, error } = await sb.schema('customer').from('install_view').select('*').limit(10000);
  if (error) throw error;
  return data || [];
}

// ===== 차트 헬퍼 =====
function renderChart(id, config) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  charts[id] = new Chart(ctx, config);
}

// ===== 차트 제목에 필터 배지 표시 =====
const FILTERED_CHART_LABELS = {
  chartFunnel:        '계약 전환 퍼널',
  chartPayType:       '결제방법별 비율',
  chartInflowChannel: '상담채널별 유입',
  chartInstallType:   '설치구조별 분포',
  chartInstaller:     '시공기사별 담당',
};
function updateFilterBadges(ym) {
  Object.entries(FILTERED_CHART_LABELS).forEach(([id, label]) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const h3 = canvas.closest('.chart-card')?.querySelector('h3');
    if (h3) h3.textContent = ym ? `${label} (${ym})` : label;
  });
}

// ===== 전역 월 필터 초기화 =====
function initGlobalMonthFilter() {
  const sel = document.getElementById('globalMonthSelect');

  // 데이터에서 월 목록 수집 (install_date + inflow_date 둘 다)
  const monthSet = new Set();
  _kpiInstalls.forEach(i => {
    const ym1 = ymKey(i.install_date);  if (ym1) monthSet.add(ym1);
    const ym2 = ymKey(i.inflow_date);   if (ym2) monthSet.add(ym2);
  });
  const months = Array.from(monthSet).sort().reverse();

  sel.innerHTML = '<option value="">전체 기간</option>' +
    months.map(m => `<option value="${m}">${m}</option>`).join('');

  sel.addEventListener('change', () => {
    globalMonth = sel.value;

    // 5개 차트 갱신
    renderFilteredCharts(globalMonth);

    // KPI 갱신
    if (globalMonth) {
      renderKPIsMonthly(globalMonth);
    } else {
      renderKPIs(_kpiCustomers, _kpiInstalls);
    }
  });
}

// ===== 전역 필터 적용 5개 차트 일괄 렌더 =====
function renderFilteredCharts(ym) {
  renderFunnelChart(ym);
  renderPayTypeChart(ym);
  renderInflowChannelChart(ym);
  renderInstallTypeChart(ym);
  renderInstallerChart(ym);
  updateFilterBadges(ym);
}

// ─────────────────────────────────────────────
// ■ 필터 적용 차트 1: 계약 전환 퍼널
//   전체: 전체 install status 분포
//   월별: 해당 월 inflow 고객의 현재 status 분포
// ─────────────────────────────────────────────
function renderFunnelChart(ym) {
  const statusCount = {};
  if (ym) {
    _kpiInstalls.filter(i => ymKey(i.inflow_date) === ym).forEach(i => {
      const s = i.status || '미정';
      statusCount[s] = (statusCount[s] || 0) + 1;
    });
  } else {
    _kpiInstalls.forEach(i => {
      const s = i.status || '미정';
      statusCount[s] = (statusCount[s] || 0) + 1;
    });
  }
  const funnelCounts = FUNNEL_ORDER.map(s => statusCount[s] || 0);
  renderChart('chartFunnel', {
    type: 'bar',
    data: {
      labels: FUNNEL_ORDER,
      datasets: [{ label: '건수', data: funnelCounts, backgroundColor: FUNNEL_ORDER.map((_, i) => COLORS.palette[i % COLORS.palette.length]) }]
    },
    options: baseOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, grid: { color: COLORS.grid } }, y: { grid: { display: false } } }
    })
  });
}

// ─────────────────────────────────────────────
// ■ 필터 적용 차트 2: 결제방법별 비율
//   월별: install_date 기준
// ─────────────────────────────────────────────
function renderPayTypeChart(ym) {
  let data = _kpiInstalls.filter(i => i.status === '시공완료' && i.quote_amount != null);
  if (ym) data = data.filter(i => ymKey(i.install_date) === ym);
  const payCount = {};
  const payAmount = {};
  data.forEach(i => {
    const p = i.pay_type || '미정';
    payCount[p]  = (payCount[p]  || 0) + 1;
    payAmount[p] = (payAmount[p] || 0) + (Number(i.quote_amount) || 0);
  });
  const payEntries = Object.entries(payCount).sort((a, b) => b[1] - a[1]);
  const amounts = payEntries.map(e => payAmount[e[0]] || 0);
  renderChart('chartPayType', {
    type: 'doughnut',
    data: {
      labels: payEntries.map(e => e[0]),
      datasets: [{ data: payEntries.map(e => e[1]), backgroundColor: payEntries.map((_, i) => COLORS.palette[i % COLORS.palette.length]), borderWidth: 2, borderColor: '#fff' }]
    },
    options: baseOpts({
      cutout: '60%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, padding: 10 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const count  = ctx.parsed;
              const amount = amounts[ctx.dataIndex];
              return `  ${ctx.label}: ${count}건 · 합계 ${fmt.wonShort(amount)}원`;
            }
          }
        }
      }
    })
  });
}

// ─────────────────────────────────────────────
// ■ 필터 적용 차트 3: 상담채널별 유입
//   월별: inflow_date 기준
// ─────────────────────────────────────────────
function renderInflowChannelChart(ym) {
  let data = _kpiInstalls;
  if (ym) data = data.filter(i => ymKey(i.inflow_date) === ym);
  const channelCount = {};
  data.forEach(i => { const ch = i.inflow_type || '미정'; channelCount[ch] = (channelCount[ch] || 0) + 1; });
  const channelEntries = Object.entries(channelCount).sort((a, b) => b[1] - a[1]);
  renderChart('chartInflowChannel', {
    type: 'bar',
    data: {
      labels: channelEntries.map(e => e[0]),
      datasets: [{ label: '고객 수', data: channelEntries.map(e => e[1]), backgroundColor: COLORS.accent }]
    },
    options: baseOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: COLORS.grid }, beginAtZero: true }, y: { grid: { display: false } } }
    })
  });
}

// ─────────────────────────────────────────────
// ■ 필터 적용 차트 4: 설치구조별 분포
//   월별: install_date 기준
// ─────────────────────────────────────────────
function renderInstallTypeChart(ym) {
  let data = _kpiInstalls;
  if (ym) data = data.filter(i => ymKey(i.install_date) === ym);
  const typeCount = {};
  data.forEach(i => { const t = (i.install_type && i.install_type.trim()) || '미정'; typeCount[t] = (typeCount[t] || 0) + 1; });
  const typeEntries = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);
  const top6 = typeEntries.slice(0, 6);
  const restCount = typeEntries.slice(6).reduce((s, e) => s + e[1], 0);
  if (restCount > 0) top6.push(['기타', restCount]);
  renderChart('chartInstallType', {
    type: 'doughnut',
    data: {
      labels: top6.map(e => e[0]),
      datasets: [{ data: top6.map(e => e[1]), backgroundColor: top6.map((_, i) => COLORS.palette[i % COLORS.palette.length]), borderWidth: 2, borderColor: '#fff' }]
    },
    options: baseOpts({ cutout: '60%' })
  });
}

// ─────────────────────────────────────────────
// ■ 필터 적용 차트 5: 시공기사별 담당
//   월별: install_date 기준
// ─────────────────────────────────────────────
function renderInstallerChart(ym) {
  let data = _kpiInstalls;
  if (ym) data = data.filter(i => ymKey(i.install_date) === ym);
  const installerCount = {};
  data.forEach(i => { if (!i.installer) return; installerCount[i.installer] = (installerCount[i.installer] || 0) + 1; });
  const installerEntries = Object.entries(installerCount).sort((a, b) => b[1] - a[1]);
  renderChart('chartInstaller', {
    type: 'bar',
    data: {
      labels: installerEntries.map(e => e[0]),
      datasets: [{ label: '담당 건수', data: installerEntries.map(e => e[1]), backgroundColor: COLORS.sec }]
    },
    options: baseOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: COLORS.grid }, beginAtZero: true }, y: { grid: { display: false } } }
    })
  });
}


// ===== 진행 중 툴팁 업데이트 =====
function updateInProgressTooltip(installs) {
  const tooltip = document.getElementById('kpiInProgressTooltip');
  if (!tooltip) return;

  const progressStatuses = STATUS_ORDER.filter(s => !NON_PROGRESS.has(s));
  const statusCount = {};
  installs.forEach(i => {
    if (!NON_PROGRESS.has(i.status || '')) {
      const s = i.status || '상태미입력';
      statusCount[s] = (statusCount[s] || 0) + 1;
    }
  });

  const total = Object.values(statusCount).reduce((a, b) => a + b, 0);
  // STATUS_ORDER 순서대로 + '상태미입력' 마지막에 추가
  const orderedStatuses = [...progressStatuses, '상태미입력'];
  const rows = orderedStatuses
    .filter(s => statusCount[s] > 0)
    .map(s => `<div class="kpi-tooltip-row">
      <span class="t-status">${s}</span>
      <span class="t-count">${statusCount[s]}건</span>
    </div>`)
    .join('');

  tooltip.innerHTML = `
    <div class="kpi-tooltip-title">상태별 진행 현황</div>
    ${rows}
    <hr class="kpi-tooltip-divider">
    <div class="kpi-tooltip-total">
      <span>합계</span><span>${total}건</span>
    </div>`;
}

// ===== KPI: 월별 =====
function renderKPIsMonthly(ym) {
  // inflow_date 기준 신규 유입 고객
  const newCustomers  = _kpiInstalls.filter(i => ymKey(i.inflow_date) === ym);
  // 진행 중 · 완료 · 매출 모두 inflow_date 기준으로 통일
  const inProgress    = newCustomers.filter(i => !NON_PROGRESS.has(i.status || '')).length;
  const completedRows = newCustomers.filter(i => i.status === '시공완료');
  const completed     = completedRows.length;
  const totalRevenue  = completedRows.reduce((s, i) => s + (Number(i.quote_amount) || 0), 0);
  const avgQuote      = completedRows.length ? totalRevenue / completedRows.length : 0;

  const convertedCount = newCustomers.filter(i =>
    i.status === '계약완료' || i.status === '시공완료'
  ).length;
  const conversion = newCustomers.length ? (convertedCount / newCustomers.length) * 100 : 0;

  document.querySelector('.kpi-card:first-child .kpi-label').textContent = '신규 유입';
  document.getElementById('kpiTotalCustomers').textContent = fmt.num(newCustomers.length);
  document.getElementById('kpiInProgress').textContent     = fmt.num(inProgress);
  document.getElementById('kpiCompleted').textContent      = fmt.num(completed);
  document.getElementById('kpiRevenue').textContent        = fmt.wonShort(totalRevenue);
  document.getElementById('kpiAvgQuote').textContent       = fmt.wonShort(Math.round(avgQuote));
  document.getElementById('kpiConversion').textContent     = fmt.pct(conversion);
  updateInProgressTooltip(newCustomers);
}

// ===== KPI: 전체 누적 =====
function renderKPIs(installs) {
  // inflow_date가 있는 건 = 유입 고객 수
  const totalCustomers = installs.filter(i => i.inflow_date).length || installs.length;
  const inProgress     = installs.filter(i => !NON_PROGRESS.has(i.status)).length;
  const completed      = installs.filter(i => i.status === '시공완료').length;
  const completedRows  = installs.filter(i => i.status === '시공완료');
  const totalRevenue   = completedRows.reduce((s, i) => s + (Number(i.quote_amount) || 0), 0);
  const avgQuote       = completedRows.length ? totalRevenue / completedRows.length : 0;
  const contracted     = installs.filter(i => i.status === '계약완료' || i.status === '시공완료').length;
  const conversion     = installs.length ? (contracted / installs.length) * 100 : 0;

  document.querySelector('.kpi-card:first-child .kpi-label').textContent = '전체 고객';
  document.getElementById('kpiTotalCustomers').textContent = fmt.num(totalCustomers);
  document.getElementById('kpiInProgress').textContent     = fmt.num(inProgress);
  document.getElementById('kpiCompleted').textContent      = fmt.num(completed);
  document.getElementById('kpiRevenue').textContent        = fmt.wonShort(totalRevenue);
  document.getElementById('kpiAvgQuote').textContent       = fmt.wonShort(Math.round(avgQuote));
  document.getElementById('kpiConversion').textContent     = fmt.pct(conversion);
  updateInProgressTooltip(installs);
}

// ===== Section 2: 영업 분석 (상태별 분포 + 월간 현황 — 필터 미적용) =====
function renderSalesCharts(installs) {
  // 상태별 분포
  const statusCount = {};
  installs.forEach(i => { const s = i.status || '미정'; statusCount[s] = (statusCount[s] || 0) + 1; });
  const statusEntries = Object.entries(statusCount).sort((a, b) => b[1] - a[1]);
  renderChart('chartStatusDist', {
    type: 'bar',
    data: {
      labels: statusEntries.map(e => e[0]),
      datasets: [{ label: '건수', data: statusEntries.map(e => e[1]), backgroundColor: COLORS.main }]
    },
    options: baseOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: COLORS.grid } }, y: { grid: { display: false } } }
    })
  });

  // 상태별 월간 현황 (최근 6개월)
  const months = lastNMonths(6);
  const monthStatusMap = {};
  months.forEach(m => monthStatusMap[m] = {});
  installs.forEach(i => {
    const ym = ymKey(i.install_date);
    if (!ym || !(ym in monthStatusMap)) return;
    const s = i.status || '미정';
    monthStatusMap[ym][s] = (monthStatusMap[ym][s] || 0) + 1;
  });
  const statusDatasets = STATUS_ORDER.map((s, idx) => ({
    label: s,
    data: months.map(m => monthStatusMap[m][s] || 0),
    backgroundColor: COLORS.palette[idx % COLORS.palette.length]
  })).filter(ds => ds.data.some(v => v > 0));
  renderChart('chartStatusMonthly', {
    type: 'bar',
    data: { labels: months, datasets: statusDatasets },
    options: baseOpts({
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, grid: { color: COLORS.grid }, beginAtZero: true }
      }
    })
  });

  // 계약 전환 퍼널 (전역 필터 함수 호출)
  renderFunnelChart(globalMonth);
}

// ===== Section 3: 매출 분석 (월별·일별 매출 — 필터 미적용) =====
function renderRevenueCharts(installs) {
  const completed = installs.filter(i => i.status === '시공완료' && i.quote_amount != null);

  // 월별 매출
  const months6 = lastNMonths(6);
  const monthRev = Object.fromEntries(months6.map(m => [m, 0]));
  completed.forEach(i => { const ym = ymKey(i.install_date); if (ym && ym in monthRev) monthRev[ym] += Number(i.quote_amount) || 0; });
  renderChart('chartRevenueMonthly', {
    type: 'line',
    data: {
      labels: months6,
      datasets: [{ label: '매출', data: months6.map(m => monthRev[m]), borderColor: COLORS.main, backgroundColor: 'rgba(24,95,165,0.15)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: COLORS.main }]
    },
    options: baseOpts({
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt.won(ctx.parsed.y) + '원' } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: COLORS.grid }, beginAtZero: true, ticks: { callback: v => fmt.wonShort(v) } } }
    })
  });

  // 일별 매출
  const days30 = lastNDays(30);
  const dayRev = Object.fromEntries(days30.map(d => [d, 0]));
  completed.forEach(i => { const d = ymdKey(i.install_date); if (d && d in dayRev) dayRev[d] += Number(i.quote_amount) || 0; });
  renderChart('chartRevenueDaily', {
    type: 'bar',
    data: {
      labels: days30.map(d => d.slice(5)),
      datasets: [{ label: '매출', data: days30.map(d => dayRev[d]), backgroundColor: COLORS.sec }]
    },
    options: baseOpts({
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt.won(ctx.parsed.y) + '원' } } },
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } }, y: { grid: { color: COLORS.grid }, beginAtZero: true, ticks: { callback: v => fmt.wonShort(v) } } }
    })
  });

  // 결제방법별 비율 (전역 필터 함수 호출)
  renderPayTypeChart(globalMonth);
}

// ===== Section 4: 마케팅 분석 (채널별 월간 추이 — 필터 미적용) =====
function renderMarketingCharts(installs) {
  // 상담채널별 유입 (전역 필터 함수 호출)
  renderInflowChannelChart(globalMonth);

  // 채널별 월간 유입 (멀티 라인, inflow_date 기준 — null inflow_type 제외)
  const channelCount = {};
  installs.forEach(i => {
    if (!i.inflow_type || !i.inflow_date) return; // 유입 정보 없는 건 제외
    channelCount[i.inflow_type] = (channelCount[i.inflow_type] || 0) + 1;
  });
  const top4 = Object.entries(channelCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0]);
  const months6 = lastNMonths(6);
  const channelMonthMap = {};
  top4.forEach(ch => { channelMonthMap[ch] = Object.fromEntries(months6.map(m => [m, 0])); });
  installs.forEach(i => {
    const ym = ymKey(i.inflow_date);
    const ch = i.inflow_type;
    if (!ym || !ch || !top4.includes(ch) || !(ym in channelMonthMap[ch])) return;
    channelMonthMap[ch][ym]++;
  });
  renderChart('chartInflowMonthly', {
    type: 'line',
    data: {
      labels: months6,
      datasets: top4.map((ch, idx) => ({
        label: ch,
        data: months6.map(m => channelMonthMap[ch][m]),
        borderColor: COLORS.palette[idx % COLORS.palette.length],
        backgroundColor: COLORS.palette[idx % COLORS.palette.length],
        tension: 0.3,
        pointRadius: 3
      }))
    },
    options: baseOpts({
      scales: { x: { grid: { display: false } }, y: { grid: { color: COLORS.grid }, beginAtZero: true } }
    })
  });
}

// ===== Section 5: 운영 현황 (월별 시공 추이 — 필터 미적용) =====
function renderOperationCharts(installs) {
  // 월별 시공 추이
  const months7 = lastNMonths(7);
  const monthInstall = Object.fromEntries(months7.map(m => [m, 0]));
  installs.forEach(i => {
    if (i.status !== '시공완료') return;
    const ym = ymKey(i.install_date);
    if (ym && ym in monthInstall) monthInstall[ym]++;
  });
  renderChart('chartInstallTrend', {
    type: 'line',
    data: {
      labels: months7,
      datasets: [{ label: '시공 건수', data: months7.map(m => monthInstall[m]), borderColor: COLORS.main, backgroundColor: COLORS.main, tension: 0.3, pointRadius: 4, fill: false }]
    },
    options: baseOpts({
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: COLORS.grid }, beginAtZero: true } }
    })
  });

  // 설치구조별 분포 + 시공기사별 담당 (전역 필터 함수 호출)
  renderInstallTypeChart(globalMonth);
  renderInstallerChart(globalMonth);
}

// ===== 에러 표시 =====
function showError(msg) {
  const existing = document.querySelector('.error-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = '⚠️ ' + msg;
  document.querySelector('.container').prepend(banner);
}

// ===== 메인 로드 =====
async function loadDashboard() {
  document.body.classList.add('is-loading');
  document.getElementById('lastUpdated').textContent = '로딩 중…';
  try {
    const installs = await fetchInstalls();
    console.log(`[Dashboard] 시공 ${installs.length}건 로드 완료`);

    _kpiInstalls = installs;

    renderKPIs(installs);
    initGlobalMonthFilter();
    renderSalesCharts(installs);
    renderRevenueCharts(installs);
    renderMarketingCharts(installs);
    renderOperationCharts(installs);

    const now = new Date();
    document.getElementById('lastUpdated').textContent =
      `최근 업데이트 ${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  } catch (err) {
    console.error('[Dashboard] 데이터 로드 실패:', err);
    document.getElementById('lastUpdated').textContent = '로드 실패';
    showError('데이터를 불러오지 못했습니다: ' + (err.message || err));
  } finally {
    document.body.classList.remove('is-loading');
  }
}

document.getElementById('refreshBtn').addEventListener('click', loadDashboard);
loadDashboard();
