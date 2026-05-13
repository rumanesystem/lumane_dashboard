/* ===========================================================
   케이트블랑 드레스룸 · 고객 목록 페이지
   =========================================================== */

// Supabase 연결: supabase-client.js 에서 sb 전역 변수 주입

let _allRows = [];
let _sortCol = 'inflow_date';
let _sortDir = 'desc';

const STATUS_COLORS = {
  '상담전':    { bg: '#F1F3F5', color: '#868E96' },
  '가능고객':  { bg: '#E7F5FF', color: '#1971C2' },
  '가망고객':  { bg: '#D0EBFF', color: '#1864AB' },
  '견적발송':  { bg: '#FFF3BF', color: '#E67700' },
  '시공일미정':{ bg: '#FFF3BF', color: '#E67700' },
  '계약완료':  { bg: '#D3F9D8', color: '#2B8A3E' },
  '시공완료':  { bg: '#B2F2BB', color: '#1B5E20' },
  '상담종료':  { bg: '#F1F3F5', color: '#868E96' },
  '반응무':    { bg: '#FFE3E3', color: '#C92A2A' },
};

// esc() 는 utils.js 에서 전역 주입

function fmtDate(d) {
  if (!d) return '-';
  return String(d).slice(0, 10);
}

function fmtWon(n) {
  if (n == null) return '-';
  return Number(n).toLocaleString('ko-KR') + '원';
}

function fmtStatus(s) {
  if (!s) return '<span class="status-badge" style="background:#F1F3F5;color:#868E96">-</span>';
  const c = STATUS_COLORS[s] || { bg: '#F1F3F5', color: '#868E96' };
  return `<span class="status-badge" style="background:${c.bg};color:${c.color}">${esc(s)}</span>`;
}

function renderTable(rows) {
  const tbody  = document.getElementById('customerTableBody');
  const countEl = document.getElementById('rowCount');
  countEl.textContent = `${rows.length.toLocaleString('ko-KR')}건`;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:40px;color:#868E96">데이터가 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((r, i) => `
    <tr data-id="${r.install_id}">
      <td class="col-idx">${i + 1}</td>
      <td class="col-name">${esc(r.name) || '-'}</td>
      <td class="col-phone">${esc(r.phone) || '-'}</td>
      <td class="col-status">${fmtStatus(r.status)}</td>
      <td class="col-date">${fmtDate(r.inflow_date)}</td>
      <td class="col-date">${fmtDate(r.install_date)}</td>
      <td class="col-amount">${fmtWon(r.quote_amount)}</td>
      <td class="col-addr">${esc(r.address) || '-'}</td>
      <td class="col-loc">${esc(r.location) || '-'}</td>
      <td class="col-pay">${esc(r.pay_type) || '-'}</td>
      <td class="col-installer">${esc(r.installer) || '-'}</td>
      <td class="col-notes" title="${esc(r.notes)}">${esc(r.notes) || '-'}</td>
    </tr>
  `).join('');

  // 행 클릭 → 사이드 패널
  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = Number(tr.dataset.id);
      const row = _allRows.find(r => r.install_id === id);
      if (row) openDetailPanel(row, tr);
    });
  });
}

const STATUS_ORDER_LIST = ['상담전','가능고객','가망고객','견적발송','시공일미정','계약완료','시공완료','상담종료','반응무'];

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    let va = a[_sortCol], vb = b[_sortCol];

    // null은 항상 맨 뒤
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;

    let cmp;
    if (_sortCol === 'quote_amount') {
      cmp = Number(va) - Number(vb);
    } else if (_sortCol === 'status') {
      cmp = STATUS_ORDER_LIST.indexOf(va) - STATUS_ORDER_LIST.indexOf(vb);
    } else {
      cmp = String(va).localeCompare(String(vb), 'ko');
    }
    return _sortDir === 'asc' ? cmp : -cmp;
  });
}

function updateSortUI() {
  document.querySelectorAll('th.sortable').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.col === _sortCol) {
      icon.textContent = _sortDir === 'asc' ? '↑' : '↓';
      th.classList.add('sort-active');
    } else {
      icon.textContent = '↕';
      th.classList.remove('sort-active');
    }
  });
}

function applyFilter() {
  const q  = document.getElementById('searchInput').value.trim().toLowerCase();
  const st = document.getElementById('statusFilter').value;

  let rows = _allRows;
  if (q)  rows = rows.filter(r =>
    (r.name  || '').toLowerCase().includes(q) ||
    (r.phone || '').toLowerCase().includes(q)
  );
  if (st) rows = rows.filter(r => r.status === st);
  renderTable(sortRows(rows));
  updateSortUI();
}

async function load() {
  const wrap = document.querySelector('.table-wrap');
  wrap.classList.add('is-loading');
  document.getElementById('lastUpdated').textContent = '로딩 중…';
  try {
    const { data, error } = await sb.schema('customer').from('install_view').select('*').limit(10000);
    if (error) throw error;

    // 유입일 내림차순, null은 맨 뒤
    _allRows = (data || []).sort((a, b) => {
      const da = a.inflow_date || '';
      const db = b.inflow_date || '';
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    });

    applyFilter();
    document.getElementById('lastUpdated').textContent =
      `마지막 업데이트: ${new Date().toLocaleTimeString('ko-KR')}`;
  } catch (e) {
    console.error(e);
    document.getElementById('customerTableBody').innerHTML =
      '<tr><td colspan="12" style="text-align:center;padding:40px;color:#C92A2A">데이터를 불러오지 못했습니다. 잠시 후 새로고침을 시도해 주세요.</td></tr>';
    document.getElementById('lastUpdated').textContent = '로드 실패';
  } finally {
    wrap.classList.remove('is-loading');
  }
}

// ===== 사이드 패널 =====
let _selectedTr = null;

function detailRow(label, value) {
  return `<div class="detail-row">
    <span class="detail-label">${label}</span>
    <span class="detail-value">${value || '-'}</span>
  </div>`;
}

function fileBadge(label, has) {
  const cls = has ? 'has' : 'none';
  const icon = has ? '✓' : '✗';
  return `<span class="file-badge ${cls}">${icon} ${label}</span>`;
}

function openDetailPanel(r, tr) {
  // 선택 행 하이라이트
  if (_selectedTr) _selectedTr.classList.remove('row-selected');
  _selectedTr = tr;
  tr.classList.add('row-selected');

  // 헤더
  document.getElementById('detailName').textContent = r.name || '-';
  document.getElementById('detailStatus').innerHTML = fmtStatus(r.status);

  // 본문 구성
  const phone = r.phone || '';
  const isInsta = phone.startsWith('@') && !phone.startsWith('@no_contact_');
  const isNoContact = phone.startsWith('@no_contact_');
  const phoneTxt = isNoContact ? '연락처 없음' : (phone || '-');

  document.getElementById('detailBody').innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">기본 정보</div>
      ${detailRow('연락처', `<span class="${isInsta ? 'contact-insta' : isNoContact ? 'contact-none' : 'contact-phone'}">${phoneTxt}</span>`)}
      ${detailRow('유입 채널', esc(r.inflow_type))}
      ${detailRow('유입일', fmtDate(r.inflow_date))}
      ${detailRow('다음 상담일', fmtDate(r.next_consult_date))}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">시공 정보</div>
      ${detailRow('시공일', fmtDate(r.install_date))}
      ${detailRow('설치구조', esc(r.install_type))}
      ${detailRow('시공기사', esc(r.installer))}
      ${detailRow('지역', esc(r.region))}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">견적 · 결제</div>
      ${detailRow('견적금액', fmtWon(r.quote_amount))}
      ${detailRow('결제방법', esc(r.pay_type))}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">파일 보유</div>
      <div style="padding:4px 0;">
        ${fileBadge('견적서', r.has_quote)}
        ${fileBadge('방사진', r.has_room_photo)}
        ${fileBadge('시공사진', r.has_install_photo)}
      </div>
    </div>
    ${r.address || r.location ? `
    <div class="detail-section">
      <div class="detail-section-title">주소</div>
      ${detailRow('주소', esc(r.address))}
      ${detailRow('위치', esc(r.location))}
    </div>` : ''}
    ${r.notes ? `
    <div class="detail-section">
      <div class="detail-section-title">메모</div>
      <div class="detail-memo">${esc(r.notes)}</div>
    </div>` : ''}
  `;

  document.getElementById('detailPanel').classList.add('open');
}

function closeDetailPanel() {
  document.getElementById('detailPanel').classList.remove('open');
  if (_selectedTr) { _selectedTr.classList.remove('row-selected'); _selectedTr = null; }
}

document.getElementById('detailClose').addEventListener('click', closeDetailPanel);

// ===== 컬럼 헤더 클릭 정렬 =====
document.querySelectorAll('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (_sortCol === col) {
      _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      _sortCol = col;
      _sortDir = 'desc';
    }
    applyFilter();
  });
});

let _searchTimer = null;
document.getElementById('searchInput').addEventListener('input', () => {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(applyFilter, 300);
});
document.getElementById('statusFilter').addEventListener('change', applyFilter);
document.getElementById('refreshBtn').addEventListener('click', load);

load();
