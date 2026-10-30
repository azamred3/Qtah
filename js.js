(function () {
  'use strict';

  const CURRENCY = 'ر.س';
  const EMOJIS = ['👤','😎','🧔','👨','👱','🧑','👦','👴','⚪','🎮','🎯','🎸','🎨','📚','🚗','💼','🍔','☕','🌙','⭐','🔥','💎','🎥','📱'];
  const COLORS = ['#818cf8','#c084fc','#f472b6','#34d399','#fbbf24','#60a5fa','#f87171','#a78bfa','#fb923c','#22d3ee'];
  const CATEGORIES = [
    { emoji: '🧾', label: 'أخرى' }, { emoji: '🍔', label: 'طعام' }, { emoji: '☕', label: 'قهوة' }, { emoji: '🛒', label: 'بقالة' },
    { emoji: '⛽', label: 'بنزين' }, { emoji: '🚗', label: 'مواصلات' }, { emoji: '🏠', label: 'سكن' }, { emoji: '🎮', label: 'ترفيه' },
    { emoji: '💊', label: 'صحة' }, { emoji: '📱', label: 'اتصالات' }, { emoji: '🎁', label: 'هدايا' }, { emoji: '✈️', label: 'سفر' }
  ];
  const APPLE_LOGO_PATH = "M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z";

  let state = { members: [], expenses: [], payments: [], debts: [], theme: 'dark' };
  let currentTheme = 'dark';
  let editingExpenseId = null;
  let selectedEmoji = EMOJIS[0];
  let selectedCategory = '🧾';
  let splitMode = 'equal';
  let selectedPayerId = null;
  let sheetStack = [];
  let toastTimer = null;
  let searchQuery = '';
  let currentUser = null;

  function fmt(n) { const num = Number(n) || 0; const r = Math.round(num * 100) / 100; return r.toLocaleString('en-US', { minimumFractionDigits: r % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }); }
  function money(n) { return fmt(n) + ' ' + CURRENCY; }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); if (isNaN(d.getTime())) return iso; return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function getMember(id) { return state.members.find(m => m.id === id) || null; }
  function getMemberColor(id) { const m = getMember(id); return m ? m.color : COLORS[0]; }
  function getMemberEmoji(id) { const m = getMember(id); return m ? m.emoji : '👤'; }
  function getMemberName(id) { const m = getMember(id); return m ? m.name : 'محذوف'; }
  function haptic(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms || 10); } catch (e) {} } }
  function toast(msg, type) { const el = document.getElementById('toast'); if (!el) return; el.textContent = msg; el.className = 'toast show ' + (type || ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast ' + (type || ''); }, 2400); }
  function applyTheme(theme) { currentTheme = theme; document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light'); }
  async function copyText(text) { try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); } else { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } toast('انسخ ✓', 'success'); haptic(15); return true; } catch (e) { toast('ما قدرنا ننسخ', 'error'); return false; } }

  function showFatalError(msg) {
    if (document.querySelector('[data-fatal]')) return;
    const div = document.createElement('div');
    div.setAttribute('data-fatal', '1');
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f87171;color:#fff;padding:14px;z-index:99999;font-family:sans-serif;font-size:13px;line-height:1.5;text-align:center;';
    div.innerHTML = '⚠️ ' + escapeHtml(msg);
    document.body.insertAdjacentHTML('afterbegin', div.outerHTML);
  }

  function signOutAndRedirect() {
    try { if (window.db && window.db.auth) { window.db.auth.signOut({ scope: 'local' }).catch(function () {}); } } catch (e) {}
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('sb-') === 0 || k.toLowerCase().indexOf('supabase') !== -1 || k.toLowerCase().indexOf('auth-token') !== -1) localStorage.removeItem(k); }); } catch (e) {}
    window.location.replace('index.html?logged_out=1');
  }

  function confirmDialog(title, message, confirmText, onConfirm) {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap show';
    wrap.innerHTML = '<div class="dialog"><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(message) + '</p><div class="dialog-actions"><button class="btn-secondary" data-cancel>إلغاء</button><button class="btn-danger" data-ok>' + escapeHtml(confirmText) + '</button></div></div>';
    document.body.appendChild(wrap);
    const remove = function () { wrap.remove(); };
    wrap.querySelector('[data-cancel]').onclick = remove;
    wrap.querySelector('[data-ok]').onclick = function () { remove(); onConfirm(); };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) remove(); });
  }

  // ============ "من أنا؟" ============
  function findMeAsMember() {
    if (!currentUser) return null;
    var names = [];
    try {
      if (currentUser.user_metadata && currentUser.user_metadata.display_name) names.push(currentUser.user_metadata.display_name);
      if (currentUser.email) names.push(currentUser.email.split('@')[0]);
    } catch (e) {}
    for (var i = 0; i < names.length; i++) {
      var n = String(names[i] || '').trim().toLowerCase();
      if (!n) continue;
      var found = state.members.find(function (m) { return String(m.name || '').trim().toLowerCase() === n; });
      if (found) return found;
    }
    return null;
  }

  function getMyMemberId() {
    if (!currentUser) return null;
    var key = 'qittat_me_member_id_' + currentUser.id;
    try {
      var saved = localStorage.getItem(key);
      if (saved && state.members.some(function (m) { return m.id === saved; })) return saved;
    } catch (e) {}
    var me = findMeAsMember();
    return me ? me.id : null;
  }

  function setMyMemberId(id) {
    if (!currentUser) return;
    try { localStorage.setItem('qittat_me_member_id_' + currentUser.id, id); } catch (e) {}
  }

  function pickMyMemberDialog(onPicked) {
    var wrap = document.createElement('div');
    wrap.className = 'me-pick-wrap';
    wrap.innerHTML =
      '<div class="me-pick-dialog">' +
        '<div class="me-pick-head">' +
          '<h3>👋 عرّفنا عليك</h3>' +
          '<p>اختر اسمك من القائمة — راح نتذكرك، وكل قطعة جديدة تكون <b>أنت اللي دفعتها</b> تلقائياً</p>' +
        '</div>' +
        '<div class="me-pick-list">' +
          state.members.map(function (m) {
            return '<button type="button" class="me-pick-item" data-pick="' + m.id + '">' +
              '<div class="avatar" style="background:' + m.color + '25;color:' + m.color + '">' + m.emoji + '</div>' +
              '<div class="name">' + escapeHtml(m.name) + '</div>' +
              '<div class="arrow">‹</div>' +
              '</button>';
          }).join('') +
        '</div>' +
        '<button type="button" class="me-pick-cancel">إلغاء</button>' +
      '</div>';
    document.body.appendChild(wrap);
    var remove = function () { wrap.remove(); };
    wrap.querySelector('.me-pick-cancel').onclick = remove;
    wrap.addEventListener('click', function (e) { if (e.target === wrap) remove(); });
    wrap.querySelectorAll('[data-pick]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.dataset.pick;
        setMyMemberId(id);
        remove();
        haptic(15);
        toast('تمام! كل قطعة جديدة راح تكون أنت دافعها ⚡', 'success');
        onPicked(id);
      };
    });
  }

  function computeBalances() {
    const bal = {};
    state.members.forEach(m => { bal[m.id] = 0; });
    state.expenses.forEach(exp => {
      const amount = Number(exp.amount) || 0;
      if (bal[exp.payer_id] !== undefined) bal[exp.payer_id] += amount;
      (exp.participants || []).forEach(p => {
        const share = Number(p.share) || 0;
        if (bal[p.memberId] !== undefined) bal[p.memberId] -= share;
        if (p.paid && p.memberId !== exp.payer_id) { if (bal[p.memberId] !== undefined) bal[p.memberId] += share; if (bal[exp.payer_id] !== undefined) bal[exp.payer_id] -= share; }
      });
    });
    state.payments.forEach(pay => { const amount = Number(pay.amount) || 0; if (bal[pay.from_id] !== undefined) bal[pay.from_id] += amount; if (bal[pay.to_id] !== undefined) bal[pay.to_id] -= amount; });
    state.debts.forEach(d => { const amount = Number(d.amount) || 0; if (bal[d.debtor_id] !== undefined) bal[d.debtor_id] -= amount; if (bal[d.creditor_id] !== undefined) bal[d.creditor_id] += amount; });
    Object.keys(bal).forEach(k => { bal[k] = Math.round(bal[k] * 100) / 100; });
    return bal;
  }

  function computeSettlements() {
    const bal = computeBalances();
    const creditors = [], debtors = [];
    Object.keys(bal).forEach(id => {
      if (bal[id] > 0.005) creditors.push({ id, amount: bal[id] });
      else if (bal[id] < -0.005) debtors.push({ id, amount: -bal[id] });
    });
    creditors.sort((a, b) => b.amount - a.amount); debtors.sort((a, b) => b.amount - a.amount);
    const transfers = []; let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i], c = creditors[j];
      const amount = Math.min(d.amount, c.amount);
      if (amount > 0.005) transfers.push({ fromId: d.id, toId: c.id, amount: Math.round(amount * 100) / 100 });
      d.amount -= amount; c.amount -= amount;
      if (d.amount < 0.005) i++; if (c.amount < 0.005) j++;
    }
    return transfers;
  }

  function totalPending() { const bal = computeBalances(); let sum = 0; Object.values(bal).forEach(v => { if (v < 0) sum += -v; }); return Math.round(sum * 100) / 100; }
  function totalReceivable() { const bal = computeBalances(); let sum = 0; Object.values(bal).forEach(v => { if (v > 0) sum += v; }); return Math.round(sum * 100) / 100; }

  async function loadAllData() {
    if (!window.db) throw new Error('window.db غير موجود');
    const sessionRes = await window.db.auth.getSession();
    const session = sessionRes && sessionRes.data && sessionRes.data.session;
    if (!session || !session.user) { window.location.replace('index.html'); throw new Error('no session'); }
    currentUser = session.user;

    const membersRes = await window.db.from('qittat_members').select('*').order('created_at');
    if (membersRes.error) showFatalError('فشل تحميل الأعضاء: ' + membersRes.error.message);
    state.members = membersRes.data || [];

    const expRes = await window.db.from('qittat_expenses').select('*').order('date', { ascending: false });
    state.expenses = expRes.data || [];
    const payRes = await window.db.from('qittat_payments').select('*').order('date', { ascending: false });
    state.payments = payRes.data || [];
    const debtRes = await window.db.from('qittat_debts').select('*').order('date', { ascending: false });
    state.debts = debtRes.data || [];

    renderActivePanel(currentTab());
    renderSummary();
  }

  function renderSummary() {
    const total = state.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const e1 = document.getElementById('sumTotal'); if (e1) e1.textContent = money(total);
    const e2 = document.getElementById('sumMembers'); if (e2) e2.textContent = state.members.length;
    const e3 = document.getElementById('sumExpenses'); if (e3) e3.textContent = state.expenses.length;
    const e4 = document.getElementById('sumPending'); if (e4) e4.textContent = money(totalPending());
  }

  function switchTab(tab) {
    document.querySelectorAll('#tabs .seg').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
    renderActivePanel(tab);
  }
  function currentTab() { const a = document.querySelector('#tabs .seg.active'); return a ? a.dataset.tab : 'members'; }
  function renderActivePanel(tab) {
    try {
      if (tab === 'members') renderMembers();
      else if (tab === 'expenses') renderExpenses();
      else if (tab === 'settle') renderSettle();
      renderSummary();
    } catch (e) { console.error('render error:', e); showFatalError('خطأ في العرض: ' + e.message); }
  }

  function renderMembers() {
    const panel = document.getElementById('panel-members');
    if (!panel) return;
    if (state.members.length === 0) {
      panel.innerHTML = '<div class="empty"><div class="empty-icon">👥</div><div class="empty-title">ما فيه أعضاء للحين</div><div class="empty-sub">ضف أول واحد عشان تبدأ</div><button class="empty-cta" id="emptyAddMember">+ ضف أول عضو</button></div>';
      panel.querySelector('#emptyAddMember').onclick = function () { openMemberSheet(); };
      return;
    }
    const balances = computeBalances();
    const creditors = [], debtors = [], settled = [];
    state.members.forEach(m => { const bal = balances[m.id] || 0; if (bal > 0.005) creditors.push({ m, bal }); else if (bal < -0.005) debtors.push({ m, bal }); else settled.push({ m, bal }); });
    creditors.sort((a, b) => b.bal - a.bal); debtors.sort((a, b) => a.bal - b.bal);

    let html = '<div class="members-overview"><div class="overview-card creditor"><div class="overview-card-label">اللي لهم</div><div class="overview-card-value">' + money(totalReceivable()) + '</div></div><div class="overview-card debtor"><div class="overview-card-label">اللي عليهم</div><div class="overview-card-value">' + money(totalPending()) + '</div></div></div>';
    if (creditors.length) html += '<div class="member-group"><div class="section-head"><h3>💰 لهم (' + creditors.length + ')</h3></div><div class="card-list">' + creditors.map(x => memberRow(x.m, x.bal)).join('') + '</div></div>';
    if (debtors.length) html += '<div class="member-group"><div class="section-head"><h3>❤️ عليهم (' + debtors.length + ')</h3></div><div class="card-list">' + debtors.map(x => memberRow(x.m, x.bal)).join('') + '</div></div>';
    if (settled.length) html += '<div class="member-group"><div class="section-head"><h3>✓ سددوا (' + settled.length + ')</h3></div><div class="card-list">' + settled.map(x => memberRow(x.m, x.bal)).join('') + '</div></div>';
    html += '<div class="action-row"><button class="btn-secondary" id="addMemberBtn">+ ضف واحد</button></div>';
    panel.innerHTML = html;
    panel.querySelectorAll('[data-member]').forEach(row => { row.onclick = () => openMemberInfo(row.dataset.member); });
    const addBtn = panel.querySelector('#addMemberBtn'); if (addBtn) addBtn.onclick = function () { openMemberSheet(); };
  }

  function memberRow(m, net) {
    let sub, cls = '';
    if (net > 0.005) { sub = 'له ' + money(net); cls = 'pos'; } else if (net < -0.005) { sub = 'عليه ' + money(-net); cls = 'neg'; } else { sub = 'سدد'; }
    return '<div class="row-item" data-member="' + m.id + '"><div class="avatar" style="background:' + m.color + '25;color:' + m.color + '">' + m.emoji + '</div><div class="item-main"><div class="item-title">' + escapeHtml(m.name) + '</div><div class="item-sub ' + cls + '">' + sub + '</div></div><div class="item-amount ' + cls + '">' + (net > 0 ? '+' : '') + fmt(net) + '</div></div>';
  }

  function openMemberInfo(memberId) {
    const m = getMember(memberId); if (!m) return;
    const balances = computeBalances(); const net = balances[memberId] || 0;
    const html = '<div style="text-align:center;padding:8px 0 12px"><div class="avatar" style="width:76px;height:76px;font-size:36px;margin:0 auto 10px;background:' + m.color + '25;color:' + m.color + '">' + m.emoji + '</div><div style="font-size:22px;font-weight:800">' + escapeHtml(m.name) + '</div></div><div class="detail-list"><div class="detail-row"><span class="k">الصافي</span><span class="v ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '') + '">' + (net > 0 ? '+' : '') + money(net) + '</span></div></div><div class="action-row"><button class="btn-secondary" id="editMemberBtn">عدّل</button><button class="btn-danger" id="deleteMemberBtn">احذف</button></div>';
    document.getElementById('infoTitle').textContent = 'تفاصيله'; const body = document.getElementById('infoBody'); body.innerHTML = html; openSheet('sheet-info');
    body.querySelector('#editMemberBtn').onclick = function () { closeSheet('sheet-info'); openMemberSheet(memberId); };
    body.querySelector('#deleteMemberBtn').onclick = function () { closeSheet('sheet-info'); confirmDialog('حذف العضو', 'تبي تحذف "' + m.name + '"؟', 'احذف', function () { deleteMember(memberId); }); };
  }

  async function deleteMember(id) {
    const res = await window.db.from('qittat_members').delete().eq('id', id);
    if (res.error) { toast('فشل الحذف', 'error'); return; }
    toast('انحذف', 'success'); haptic(20); await loadAllData();
  }

  function renderExpenses() {
    const panel = document.getElementById('panel-expenses');
    if (!panel) return;
    const heroBtn = '<button class="add-expense-hero" id="addExpenseHero"><div class="add-hero-icon"><span>+</span></div><div class="add-hero-text"><div class="add-hero-title">قطة جديدة</div><div class="add-hero-sub">سجل قطة وحدد مين معك</div></div></button>';
    const searchBar = '<div class="search-bar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="text" id="searchInput" placeholder="دوّر في القطات..." value="' + escapeHtml(searchQuery) + '" /></div>';
    if (state.expenses.length === 0) {
      panel.innerHTML = heroBtn + '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">ما فيه قطات</div><button class="empty-cta" id="emptyAddExpense">قطة جديدة</button></div>';
      panel.querySelector('#addExpenseHero').onclick = function () { openExpenseSheet(); };
      panel.querySelector('#emptyAddExpense').onclick = function () { openExpenseSheet(); };
      return;
    }
    let filtered = state.expenses.slice();
    if (searchQuery.trim()) { const q = searchQuery.trim().toLowerCase(); filtered = filtered.filter(e => e.title.toLowerCase().includes(q) || getMemberName(e.payer_id).toLowerCase().includes(q)); }
    let rows = filtered.length === 0 ? '<div class="empty" style="padding:32px 20px"><div class="empty-icon" style="font-size:32px">🔍</div><div class="empty-title" style="font-size:15px">ما فيه نتائج</div></div>' : '<div class="card-list">' + filtered.map(e => {
      const participants = e.participants || []; const nonPayer = participants.filter(p => p.memberId !== e.payer_id); const paidCount = nonPayer.filter(p => p.paid).length; const totalCount = nonPayer.length;
      let chip = totalCount > 0 ? (paidCount === totalCount ? '<span class="status-chip all-paid">✓ الكل دفع</span>' : '<span class="status-chip partial-paid">' + paidCount + '/' + totalCount + '</span>') : '';
      const avatarsHtml = participants.slice(0, 4).map(p => { const mm = getMember(p.memberId); return mm ? '<div class="avatar xs" style="background:' + mm.color + '25;color:' + mm.color + '">' + mm.emoji + '</div>' : ''; }).join('');
      const extra = participants.length > 4 ? '<div class="avatar xs more">+' + (participants.length - 4) + '</div>' : '';
      return '<div class="row-item" data-exp="' + e.id + '"><div class="exp-cat">' + (e.emoji || '🧾') + '</div><div class="item-main"><div class="item-title">' + escapeHtml(e.title) + '</div><div class="item-sub">' + escapeHtml(getMemberName(e.payer_id)) + ' دفع • ' + fmtDate(e.date) + '</div><div class="avatars-row">' + avatarsHtml + extra + '</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0"><div class="item-amount"><div>' + money(e.amount) + '</div>' + chip + '</div><button class="row-copy-btn" data-copy="' + e.id + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div></div>';
    }).join('') + '</div>';
    panel.innerHTML = heroBtn + searchBar + '<div class="section-head"><h3>القطات (' + filtered.length + ')</h3></div>' + rows;
    panel.querySelector('#addExpenseHero').onclick = function () { openExpenseSheet(); };
    panel.querySelectorAll('[data-exp]').forEach(row => { row.onclick = function () { openExpenseInfo(row.dataset.exp); }; });
    panel.querySelectorAll('[data-copy]').forEach(btn => { btn.onclick = function (ev) { ev.stopPropagation(); const e = state.expenses.find(x => x.id === btn.dataset.copy); if (e) copyText(generateExpenseCopyText(e)); }; });
    const searchInput = panel.querySelector('#searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function (ev) {
        searchQuery = ev.target.value; const pos = ev.target.selectionStart;
        renderExpenses();
        const ni = document.getElementById('searchInput'); if (ni) { ni.focus(); ni.setSelectionRange(pos, pos); }
      });
    }
  }

  function generateExpenseCopyText(e) {
    const participants = e.participants || []; const nonPayer = participants.filter(p => p.memberId !== e.payer_id); const paidCount = nonPayer.filter(p => p.paid).length;
    let text = '🧾 *قطة ' + e.title + '*\n───────────────\n💰 *المبلغ:* ' + money(e.amount) + '\n👤 *دفعها:* ' + getMemberName(e.payer_id) + '\n📅 *التاريخ:* ' + fmtDate(e.date) + '\n───────────────\n👥 *اللي معه (' + participants.length + '):*\n';
    participants.forEach(p => { const name = getMemberName(p.memberId); let status = ''; if (p.memberId === e.payer_id) status = ' 💳'; else if (p.paid) status = ' ✓'; text += '  • ' + name + ' — ' + money(p.share) + status + '\n'; });
    if (nonPayer.length > 0) text += '───────────────\n📊 *الحالة:* ' + paidCount + ' من ' + nonPayer.length + ' سددوا\n';
    text += '───────────────\n_من تطبيق قطة الاستراحه_';
    return text;
  }

  async function openExpenseInfo(expId) {
    const e = state.expenses.find(x => x.id === expId); if (!e) return;
    const participants = e.participants || []; const payerId = e.payer_id;
    const sorted = participants.slice().sort(function (a, b) { const ap = a.memberId === payerId, bp = b.memberId === payerId; if (ap && !bp) return -1; if (bp && !ap) return 1; return (a.paid ? 1 : 0) - (b.paid ? 1 : 0); });
    const rowsHtml = sorted.map(p => renderParticipantRow(p, payerId)).join('');
    const html = '<div style="text-align:center;padding:6px 0 12px"><div style="font-size:44px;margin-bottom:6px">' + (e.emoji || '🧾') + '</div><div style="font-size:20px;font-weight:800;margin-bottom:4px">' + escapeHtml(e.title) + '</div><div style="font-size:28px;font-weight:800;background:var(--accent-grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent">' + money(e.amount) + '</div></div><div class="detail-list"><div class="detail-row"><span class="k">دفعها</span><span class="v">' + getMemberEmoji(e.payer_id) + ' ' + escapeHtml(getMemberName(e.payer_id)) + '</span></div><div class="detail-row"><span class="k">التاريخ</span><span class="v">' + fmtDate(e.date) + '</span></div></div><div class="info-section-title">اللي معه</div><div class="card-list">' + rowsHtml + '</div><div class="copy-block"><button class="copy-exp-btn" id="copyExpBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>انسخ القطة</span></button></div><div class="action-row"><button class="btn-secondary" id="editExpBtn">عدّل</button><button class="btn-danger" id="delExpBtn">احذف</button></div>';
    document.getElementById('infoTitle').textContent = 'تفاصيل القطة'; const body = document.getElementById('infoBody'); body.innerHTML = html; openSheet('sheet-info');
    body.querySelector('#copyExpBtn').onclick = function () { copyText(generateExpenseCopyText(e)); };
    body.querySelectorAll('[data-pay]').forEach(btn => { btn.onclick = async function () { const mid = btn.dataset.pay; const p = participants.find(x => x.memberId === mid); if (!p) return; p.paid = true; p.paidAt = new Date().toISOString(); const upd = participants.map(x => x.memberId === mid ? p : x); await window.db.from('qittat_expenses').update({ participants: upd }).eq('id', expId); haptic(15); toast('تم الدفع ✓', 'success'); await loadAllData(); openExpenseInfo(expId); }; });
    body.querySelectorAll('[data-unpay]').forEach(btn => { btn.onclick = async function () { const mid = btn.dataset.unpay; const p = participants.find(x => x.memberId === mid); if (!p) return; p.paid = false; delete p.paidAt; const upd = participants.map(x => x.memberId === mid ? p : x); await window.db.from('qittat_expenses').update({ participants: upd }).eq('id', expId); haptic(10); toast('تم التراجع'); await loadAllData(); openExpenseInfo(expId); }; });
    body.querySelector('#editExpBtn').onclick = function () { closeSheet('sheet-info'); openExpenseSheet(expId); };
    body.querySelector('#delExpBtn').onclick = function () { closeSheet('sheet-info'); confirmDialog('حذف القطة', 'تبي تحذف "' + e.title + '"؟', 'احذف', async function () { await window.db.from('qittat_expenses').delete().eq('id', expId); toast('انحذفت', 'success'); haptic(20); await loadAllData(); }); };
  }

  function renderParticipantRow(p, payerId) {
    const m = getMember(p.memberId); const emoji = m ? m.emoji : '👤'; const color = m ? m.color : COLORS[0]; const name = m ? m.name : 'محذوف'; const isPayer = p.memberId === payerId;
    let action = isPayer ? '<span class="payer-badge">دفع</span>' : p.paid ? '<button class="unpay-btn" data-unpay="' + p.memberId + '">✓ دفع</button>' : '<button class="apple-pay-btn" data-pay="' + p.memberId + '"><svg width="13" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="' + APPLE_LOGO_PATH + '"/></svg><span>Pay</span></button>';
    return '<div class="participant-row ' + (p.paid ? 'is-paid' : '') + ' ' + (isPayer ? 'is-payer' : '') + '"><div class="avatar sm" style="background:' + color + '25;color:' + color + '">' + emoji + '</div><div class="p-info"><div class="p-name">' + escapeHtml(name) + '</div><div class="p-share">' + money(p.share) + '</div></div>' + action + '</div>';
  }

  function openExpenseSheet(expId) {
    editingExpenseId = expId || null;
    if (state.members.length === 0) { toast('ضف أعضاء أول', 'error'); return; }
    const titleEl = document.getElementById('expSheetTitle'), titleInput = document.getElementById('expTitle'), amountInput = document.getElementById('expAmount'), dateInput = document.getElementById('expDate'), participantsBox = document.getElementById('expParticipants'), hint = document.getElementById('shareHint'), distributeBtn = document.getElementById('distributeBtn'), catPicker = document.getElementById('expCategory'), payerChips = document.getElementById('expPayerChips');

    catPicker.innerHTML = CATEGORIES.map(c => '<button type="button" class="category-opt' + (c.emoji === selectedCategory ? ' active' : '') + '" data-cat="' + c.emoji + '">' + c.emoji + '</button>').join('');
    catPicker.querySelectorAll('[data-cat]').forEach(btn => { btn.onclick = function () { selectedCategory = btn.dataset.cat; catPicker.querySelectorAll('.category-opt').forEach(b => b.classList.toggle('active', b === btn)); }; });

    function buildPayerChips(selectedId) {
      var meId = getMyMemberId();
      var html = '';
      if (state.members.length > 0) {
        if (meId) {
          var meM = getMember(meId);
          var meActive = meId === selectedId;
          html += '<button type="button" class="payer-chip payer-chip-me' + (meActive ? ' active' : '') + '" data-payer-me="' + meId + '">' +
            '<div class="avatar" style="background:rgba(129,140,248,0.25);color:#a5b4fc">⚡</div>' +
            '<div class="pc-name">أنا (' + escapeHtml(meM ? meM.name : '') + ')</div>' +
            '</button>';
        } else {
          html += '<button type="button" class="payer-chip payer-chip-me payer-chip-pick" data-payer-pick="1">' +
            '<div class="avatar" style="background:rgba(129,140,248,0.25);color:#a5b4fc">⚡</div>' +
            '<div class="pc-name">أنا</div>' +
            '</button>';
        }
      }
      html += state.members.map(function (m) {
        var isMe = m.id === meId;
        return '<button type="button" class="payer-chip' + (m.id === selectedId ? ' active' : '') + '" data-payer="' + m.id + '">' +
          '<div class="avatar" style="background:' + m.color + '25;color:' + m.color + '">' + m.emoji + '</div>' +
          '<div class="pc-name">' + escapeHtml(m.name) + (isMe ? ' ★' : '') + '</div>' +
          '</button>';
      }).join('');
      payerChips.innerHTML = html;
      payerChips.querySelectorAll('[data-payer]').forEach(function (btn) {
        btn.onclick = function () {
          selectedPayerId = btn.dataset.payer;
          document.getElementById('expPayer').value = selectedPayerId;
          payerChips.querySelectorAll('.payer-chip').forEach(function (b) { b.classList.toggle('active', b === btn); });
        };
      });
      payerChips.querySelectorAll('[data-payer-me]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.dataset.payerMe;
          selectedPayerId = id;
          document.getElementById('expPayer').value = id;
          payerChips.querySelectorAll('.payer-chip').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-payer') === id || b === btn); });
          haptic(12);
        };
      });
      payerChips.querySelectorAll('[data-payer-pick]').forEach(function (btn) {
        btn.onclick = function () {
          pickMyMemberDialog(function (pickedId) {
            selectedPayerId = pickedId;
            document.getElementById('expPayer').value = pickedId;
            buildPayerChips(pickedId);
          });
        };
      });
    }

    function buildParticipants(selectedMap) {
      participantsBox.innerHTML = state.members.map(m => {
        const checked = selectedMap ? selectedMap.has(m.id) : true;
        const val = selectedMap && selectedMap.get(m.id) != null ? selectedMap.get(m.id) : '';
        return '<div class="check-item" data-pid="' + m.id + '"><label><input type="checkbox" ' + (checked ? 'checked' : '') + ' data-chk="' + m.id + '" /><span class="check-name">' + m.emoji + ' ' + escapeHtml(m.name) + '</span></label><input type="text" inputmode="decimal" class="share-input" data-share="' + m.id + '" placeholder="0" value="' + val + '" ' + (splitMode === 'equal' ? 'hidden' : '') + ' /></div>';
      }).join('');
      participantsBox.querySelectorAll('[data-chk]').forEach(chk => { chk.onchange = function () { const pid = chk.dataset.chk; const s = participantsBox.querySelector('[data-share="' + pid + '"]'); if (splitMode === 'custom') { s.disabled = !chk.checked; if (!chk.checked) s.value = ''; } updateHint(); }; });
      participantsBox.querySelectorAll('[data-share]').forEach(inp => { inp.oninput = updateHint; });
    }

    function getSelectedParticipants() {
      const result = [];
      participantsBox.querySelectorAll('[data-chk]').forEach(chk => {
        if (chk.checked) {
          const pid = chk.dataset.chk;
          const s = participantsBox.querySelector('[data-share="' + pid + '"]');
          result.push({ memberId: pid, share: s.value ? Number(s.value) : null });
        }
      });
      return result;
    }

    function updateHint() {
      const selected = getSelectedParticipants();
      const amount = Number(amountInput.value) || 0;
      if (splitMode === 'equal') {
        hint.hidden = false;
        if (selected.length === 0) { hint.className = 'hint error'; hint.textContent = 'اختر واحد على الأقل'; }
        else if (amount > 0) { hint.className = 'hint'; hint.textContent = selected.length + ' مشارك — نصيب كل واحد ' + money(amount / selected.length); }
        else { hint.className = 'hint'; hint.textContent = selected.length + ' مشارك'; }
      } else {
        hint.hidden = false;
        const sum = selected.reduce((s, p) => s + (p.share || 0), 0);
        const diff = Math.round((amount - sum) * 100) / 100;
        if (selected.length === 0) { hint.className = 'hint error'; hint.textContent = 'اختر واحد على الأقل'; }
        else if (Math.abs(diff) < 0.01 && amount > 0) { hint.className = 'hint ok'; hint.textContent = 'المجموع ' + money(sum) + ' ✓ مطابق'; }
        else { hint.className = 'hint error'; hint.textContent = 'المجموع ' + money(sum) + ' — ' + (diff > 0 ? 'ناقص' : 'زائد') + ' ' + money(Math.abs(diff)); }
      }
      distributeBtn.hidden = splitMode !== 'custom';
    }

    document.querySelectorAll('#splitMode .seg').forEach(btn => {
      btn.onclick = function () {
        splitMode = btn.dataset.mode;
        document.querySelectorAll('#splitMode .seg').forEach(b => b.classList.toggle('active', b === btn));
        const map = new Map();
        participantsBox.querySelectorAll('[data-chk]').forEach(chk => { if (chk.checked) { const pid = chk.dataset.chk; const s = participantsBox.querySelector('[data-share="' + pid + '"]'); map.set(pid, s.value); } });
        buildParticipants(map);
        updateHint();
      };
    });

    document.getElementById('selectAllBtn').onclick = function () {
      const chks = participantsBox.querySelectorAll('[data-chk]');
      const allChecked = Array.from(chks).every(c => c.checked);
      chks.forEach(c => {
        c.checked = !allChecked;
        const s = participantsBox.querySelector('[data-share="' + c.dataset.chk + '"]');
        if (splitMode === 'custom') s.disabled = allChecked;
        if (!c.checked && splitMode === 'custom') s.value = '';
      });
      updateHint();
    };

    document.getElementById('distributeBtn').onclick = function () {
      const selected = getSelectedParticipants();
      const amount = Number(amountInput.value) || 0;
      if (selected.length === 0 || amount <= 0) return;
      const each = Math.round((amount / selected.length) * 100) / 100;
      let remaining = amount;
      selected.forEach((p, idx) => {
        const s = participantsBox.querySelector('[data-share="' + p.memberId + '"]');
        let val;
        if (idx === selected.length - 1) val = Math.round(remaining * 100) / 100;
        else { val = each; remaining -= each; }
        s.value = val.toFixed(2);
      });
      updateHint();
    };

    amountInput.oninput = updateHint;
    document.querySelectorAll('#quickAmounts button').forEach(btn => { btn.onclick = function () { amountInput.value = btn.dataset.amt; updateHint(); haptic(8); }; });
    document.querySelectorAll('.quick-dates button').forEach(btn => { btn.onclick = function () { const days = Number(btn.dataset.day) || 0; const d = new Date(); d.setDate(d.getDate() - days); dateInput.value = d.toISOString().slice(0, 10); haptic(8); }; });

    if (editingExpenseId) {
      const e = state.expenses.find(x => x.id === editingExpenseId);
      if (e) {
        titleEl.textContent = 'تعديل القطة'; titleInput.value = e.title; amountInput.value = e.amount; dateInput.value = e.date || todayISO();
        selectedCategory = e.emoji || '🧾'; selectedPayerId = e.payer_id;
        catPicker.querySelectorAll('.category-opt').forEach(b => b.classList.toggle('active', b.dataset.cat === selectedCategory));
        buildPayerChips(selectedPayerId); document.getElementById('expPayer').value = selectedPayerId;
        const map = new Map(); (e.participants || []).forEach(p => map.set(p.memberId, p.share));
        const count = (e.participants || []).length; const isEqual = count > 0 && (e.participants || []).every(p => Math.abs(p.share - (e.amount / count)) < 0.01);
        splitMode = isEqual ? 'equal' : 'custom';
        document.querySelectorAll('#splitMode .seg').forEach(b => b.classList.toggle('active', b.dataset.mode === splitMode));
        buildParticipants(map);
      }
    } else {
      titleEl.textContent = 'قطة جديدة';
      titleInput.value = '';
      amountInput.value = '';
      dateInput.value = todayISO();
      selectedCategory = '🧾';
      var myId = getMyMemberId();
      selectedPayerId = myId || (state.members[0] ? state.members[0].id : null);
      catPicker.querySelectorAll('.category-opt').forEach(b => b.classList.toggle('active', b.dataset.cat === '🧾'));
      buildPayerChips(selectedPayerId);
      if (selectedPayerId) document.getElementById('expPayer').value = selectedPayerId;
      splitMode = 'equal';
      document.querySelectorAll('#splitMode .seg').forEach(b => b.classList.toggle('active', b.dataset.mode === 'equal'));
      buildParticipants(null);
      if (!myId) {
        setTimeout(function () {
          pickMyMemberDialog(function (pickedId) {
            selectedPayerId = pickedId;
            document.getElementById('expPayer').value = pickedId;
            buildPayerChips(pickedId);
          });
        }, 400);
      }
    }
    updateHint(); openSheet('sheet-expense');
    setTimeout(function () { titleInput.focus(); }, 350);
  }

  async function saveExpense() {
    const titleInput = document.getElementById('expTitle'), amountInput = document.getElementById('expAmount'), dateInput = document.getElementById('expDate'), participantsBox = document.getElementById('expParticipants');
    const title = titleInput.value.trim(); const amount = Number(amountInput.value);
    if (!title) { toast('اكتب وش هي القطة', 'error'); titleInput.focus(); return; }
    if (!amount || amount <= 0) { toast('حط مبلغ صح', 'error'); amountInput.focus(); return; }
    if (!selectedPayerId) { toast('اختر من دفع', 'error'); return; }
    const payerId = selectedPayerId; const date = dateInput.value || todayISO();
    const selected = [];
    participantsBox.querySelectorAll('[data-chk]').forEach(chk => { if (chk.checked) { const pid = chk.dataset.chk; const s = participantsBox.querySelector('[data-share="' + pid + '"]'); selected.push({ memberId: pid, shareInput: s }); } });
    if (selected.length === 0) { toast('اختر واحد على الأقل', 'error'); return; }
    let participants;
    if (splitMode === 'equal') { const each = Math.round((amount / selected.length) * 100) / 100; let remaining = amount; participants = selected.map((p, idx) => { let share; if (idx === selected.length - 1) share = Math.round(remaining * 100) / 100; else { share = each; remaining -= each; } return { memberId: p.memberId, share: share, paid: false }; }); }
    else { let sum = 0; participants = selected.map(p => { const v = Number(p.shareInput.value) || 0; sum += v; return { memberId: p.memberId, share: Math.round(v * 100) / 100, paid: false }; }); if (Math.abs(sum - amount) > 0.01) { toast('المجموع ' + money(sum) + ' ما يطابق ' + money(amount), 'error'); return; } }

    if (editingExpenseId) {
      const oldExp = state.expenses.find(x => x.id === editingExpenseId);
      participants = participants.map(p => { if (oldExp) { const oldP = (oldExp.participants || []).find(op => op.memberId === p.memberId); if (oldP && oldP.paid && Math.abs(oldP.share - p.share) < 0.01) return { memberId: p.memberId, share: p.share, paid: true, paidAt: oldP.paidAt }; } return p; });
      const res = await window.db.from('qittat_expenses').update({ title, amount, payer_id: payerId, date, emoji: selectedCategory, participants }).eq('id', editingExpenseId);
      if (res.error) { toast('فشل التعديل', 'error'); return; }
      toast('انعدلت القطة', 'success');
    } else {
      const res = await window.db.from('qittat_expenses').insert([{ user_id: currentUser.id, title, emoji: selectedCategory, amount, payer_id: payerId, date, participants }]);
      if (res.error) { toast('فشل الحفظ', 'error'); return; }
      toast('انضافت القطة', 'success');
    }
    haptic(20); closeSheet('sheet-expense'); editingExpenseId = null; await loadAllData();
  }

  function openMemberSheet(memberId) {
    selectedEmoji = EMOJIS[0];
    const title = document.getElementById('memberSheetTitle'); const nameInput = document.getElementById('memberName'); const picker = document.getElementById('emojiPicker');
    picker.innerHTML = EMOJIS.map(e => '<button type="button" class="emoji-opt' + (e === selectedEmoji ? ' active' : '') + '" data-emoji="' + e + '">' + e + '</button>').join('');
    picker.querySelectorAll('[data-emoji]').forEach(btn => { btn.onclick = function () { selectedEmoji = btn.dataset.emoji; picker.querySelectorAll('.emoji-opt').forEach(b => b.classList.toggle('active', b === btn)); }; });
    if (memberId) { const m = getMember(memberId); if (m) { title.textContent = 'تعديل'; nameInput.value = m.name; selectedEmoji = m.emoji; picker.querySelectorAll('.emoji-opt').forEach(b => b.classList.toggle('active', b.dataset.emoji === selectedEmoji)); } nameInput.dataset.editId = memberId; }
    else { title.textContent = 'واحد جديد'; nameInput.value = ''; delete nameInput.dataset.editId; }
    openSheet('sheet-member'); setTimeout(function () { nameInput.focus(); }, 350);
  }

  async function saveMember() {
    const nameInput = document.getElementById('memberName'); const name = nameInput.value.trim();
    if (!name) { toast('اكتب اسمه', 'error'); nameInput.focus(); return; }
    const editId = nameInput.dataset.editId;
    if (editId) { const r = await window.db.from('qittat_members').update({ name: name, emoji: selectedEmoji }).eq('id', editId); if (r.error) { toast('فشل', 'error'); return; } toast('انعدل', 'success'); }
    else { const r = await window.db.from('qittat_members').insert([{ user_id: currentUser.id, name: name, emoji: selectedEmoji, color: COLORS[state.members.length % COLORS.length] }]); if (r.error) { toast('فشل', 'error'); return; } toast('انضاف', 'success'); }
    haptic(15); closeSheet('sheet-member'); await loadAllData();
  }

  function openPaymentSheet() {
    if (state.members.length < 2) { toast('تحتاج اثنين على الأقل', 'error'); return; }
    const opts = state.members.map(m => '<option value="' + m.id + '">' + m.emoji + ' ' + escapeHtml(m.name) + '</option>').join('');
    document.getElementById('payFrom').innerHTML = opts; document.getElementById('payTo').innerHTML = opts; document.getElementById('payTo').selectedIndex = 1;
    document.getElementById('payAmount').value = ''; document.getElementById('payNote').value = '';
    openSheet('sheet-payment'); setTimeout(function () { document.getElementById('payAmount').focus(); }, 350);
  }

  async function savePayment() {
    const fromId = document.getElementById('payFrom').value, toId = document.getElementById('payTo').value, amount = Number(document.getElementById('payAmount').value), note = document.getElementById('payNote').value.trim();
    if (fromId === toId) { toast('ما يصير يدفع لنفسه', 'error'); return; }
    if (!amount || amount <= 0) { toast('حط مبلغ صح', 'error'); return; }
    const r = await window.db.from('qittat_payments').insert([{ user_id: currentUser.id, from_id: fromId, to_id: toId, amount: amount, note: note, date: todayISO() }]);
    if (r.error) { toast('فشل', 'error'); return; }
    closeSheet('sheet-payment'); toast('تم السداد', 'success'); haptic(15); await loadAllData();
  }

  function openDebtSheet() {
    if (state.members.length < 2) { toast('تحتاج اثنين على الأقل', 'error'); return; }
    const opts = state.members.map(m => '<option value="' + m.id + '">' + m.emoji + ' ' + escapeHtml(m.name) + '</option>').join('');
    document.getElementById('debtDebtor').innerHTML = opts; document.getElementById('debtCreditor').innerHTML = opts; document.getElementById('debtCreditor').selectedIndex = 1;
    document.getElementById('debtAmount').value = ''; document.getElementById('debtNote').value = ''; document.getElementById('debtDate').value = todayISO();
    openSheet('sheet-debt'); setTimeout(function () { document.getElementById('debtAmount').focus(); }, 350);
  }

  async function saveDebt() {
    const debtorId = document.getElementById('debtDebtor').value, creditorId = document.getElementById('debtCreditor').value, amount = Number(document.getElementById('debtAmount').value), note = document.getElementById('debtNote').value.trim(), date = document.getElementById('debtDate').value || todayISO();
    if (debtorId === creditorId) { toast('ما يصير مدين لنفسه', 'error'); return; }
    if (!amount || amount <= 0) { toast('حط مبلغ صح', 'error'); return; }
    const r = await window.db.from('qittat_debts').insert([{ user_id: currentUser.id, debtor_id: debtorId, creditor_id: creditorId, amount: amount, note: note, date: date }]);
    if (r.error) { toast('فشل', 'error'); return; }
    closeSheet('sheet-debt'); toast('تم تسجيل الدين', 'success'); haptic(15); await loadAllData();
  }

  function renderSettle() {
    const panel = document.getElementById('panel-settle');
    if (!panel) return;
    if (state.members.length === 0) {
      panel.innerHTML = '<div class="empty"><div class="empty-icon">💰</div><div class="empty-title">ما فيه أعضاء</div><div class="empty-sub">ضف أعضاء عشان تبدأ الحساب</div><button class="empty-cta" id="emptyAddMember2">+ ضف عضو</button></div>';
      panel.querySelector('#emptyAddMember2').onclick = function () { openMemberSheet(); };
      return;
    }
    const settlements = computeSettlements(); const pending = totalPending();
    let html = '';
    if (pending > 0.005) { html += '<div class="settle-hero"><div class="settle-hero-label">المجموع المتبقي</div><div class="settle-hero-amount">' + money(pending) + '</div><div class="settle-hero-row"><button class="settle-hero-btn" id="copySettlementBtn">انسخ الملخص</button><button class="settle-hero-btn" id="quickPaymentBtn">سدّد</button></div></div>'; }
    else { html += '<div class="settle-hero" style="background:var(--green)"><div class="settle-hero-label">الحالة</div><div class="settle-hero-amount" style="font-size:26px">✓ كلكم متساوين</div></div>'; }
    if (settlements.length > 0) { html += '<div class="section-head"><h3>أسهل طريقة للسداد (' + settlements.length + ')</h3></div><div class="card-list">' + settlements.map(s => '<div class="transfer-row"><div class="avatar xs" style="background:' + getMemberColor(s.fromId) + '25;color:' + getMemberColor(s.fromId) + '">' + getMemberEmoji(s.fromId) + '</div><span class="transfer-name">' + escapeHtml(getMemberName(s.fromId)) + '</span><span class="transfer-arrow">←</span><div class="avatar xs" style="background:' + getMemberColor(s.toId) + '25;color:' + getMemberColor(s.toId) + '">' + getMemberEmoji(s.toId) + '</div><span class="transfer-name">' + escapeHtml(getMemberName(s.toId)) + '</span><span class="transfer-amount">' + money(s.amount) + '</span></div>').join('') + '</div>'; }
    html += '<div class="action-row"><button class="btn-secondary" id="addDebtBtn">دين مباشر</button></div>';
    panel.innerHTML = html;
    if (pending > 0.005) {
      panel.querySelector('#copySettlementBtn').onclick = function () { let text = 'ملخص التسوية — قطة الاستراحه\n───────────────\nالمجموع المتبقي: ' + money(pending) + '\n───────────────\n'; settlements.forEach(s => { text += '• ' + getMemberName(s.fromId) + ' ← ' + getMemberName(s.toId) + ': ' + money(s.amount) + '\n'; }); copyText(text); };
      panel.querySelector('#quickPaymentBtn').onclick = function () { openPaymentSheet(); };
    }
    const addDebt = panel.querySelector('#addDebtBtn'); if (addDebt) addDebt.onclick = function () { openDebtSheet(); };
  }

  // ============ Open/Close Sheet مع body-lock class ============
  function openSheet(id) {
    const sheet = document.getElementById(id), backdrop = document.getElementById('backdrop');
    if (!sheet || !backdrop) return;
    if (sheetStack.indexOf(id) === -1) sheetStack.push(id);
    backdrop.classList.add('show');
    sheet.classList.add('open');
    document.documentElement.classList.add('sheet-open');
    document.body.classList.add('sheet-open');
    haptic(8);
  }
  function closeSheet(id) {
    const sheet = document.getElementById(id), backdrop = document.getElementById('backdrop');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheetStack = sheetStack.filter(s => s !== id);
    if (sheetStack.length === 0 && backdrop) {
      backdrop.classList.remove('show');
      document.documentElement.classList.remove('sheet-open');
      document.body.classList.remove('sheet-open');
    }
  }
  function closeAllSheets() { sheetStack.slice().forEach(id => closeSheet(id)); }

  function openUserSheet() {
    const body = document.getElementById('userBody');
    if (!body) return;
    const email = (currentUser && currentUser.email) || 'مستخدم';
    const username = email.split('@')[0];
    const initial = username.charAt(0).toUpperCase();
    const myId = getMyMemberId();
    const myMember = myId ? getMember(myId) : null;

    body.innerHTML =
      '<div class="user-info"><div class="avatar">' + initial + '</div><div class="user-info-name">' + escapeHtml(username) + '</div></div>' +
      '<button class="user-menu-item" id="myIdentityBtn"><div class="icon">' + (myMember ? myMember.emoji : '⚡') + '</div><div class="label">' + (myMember ? 'أنا: ' + escapeHtml(myMember.name) : 'حدد نفسك في القائمة') + '</div></button>' +
      '<button class="user-menu-item" id="toggleThemeBtn"><div class="icon">' + (currentTheme === 'dark' ? '☀️' : '🌙') + '</div><div class="label">الشكل: ' + (currentTheme === 'dark' ? 'ليلي' : 'نهاري') + '</div></button>' +
      '<button class="logout-btn" id="logoutBtn"><div class="icon">🚪</div><div class="label">اطلع</div></button>';

    body.querySelector('#myIdentityBtn').onclick = function () { pickMyMemberDialog(function () { openUserSheet(); }); };
    body.querySelector('#toggleThemeBtn').onclick = function () { applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); openUserSheet(); haptic(10); };
    body.querySelector('#logoutBtn').onclick = signOutAndRedirect;
    openSheet('sheet-user');
  }

  function initEvents() {
    const userBtn = document.getElementById('userBtn'); if (userBtn) userBtn.onclick = openUserSheet;
    document.querySelectorAll('#tabs .seg').forEach(btn => { btn.onclick = function () { haptic(8); switchTab(btn.dataset.tab); }; });
    const fab = document.getElementById('fabAdd'); if (fab) fab.onclick = function () { const tab = currentTab(); if (tab === 'members') openMemberSheet(); else if (tab === 'expenses') openExpenseSheet(); else openPaymentSheet(); };
    const bd = document.getElementById('backdrop'); if (bd) bd.onclick = closeAllSheets;
    document.querySelectorAll('[data-close]').forEach(btn => { btn.onclick = function () { const s = btn.closest('.sheet'); if (s) closeSheet(s.id); }; });
    const mSave = document.getElementById('memberSave'); if (mSave) mSave.onclick = saveMember;
    const eSave = document.getElementById('expenseSave'); if (eSave) eSave.onclick = saveExpense;
    const pSave = document.getElementById('paymentSave'); if (pSave) pSave.onclick = savePayment;
    const dSave = document.getElementById('debtSave'); if (dSave) dSave.onclick = saveDebt;
    const nameInput = document.getElementById('memberName'); if (nameInput) nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveMember(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAllSheets(); });
  }

  async function init() {
    applyTheme('dark');
    try { initEvents(); } catch (e) { showFatalError('فشل ربط الأزرار'); }
    try {
      if (typeof window.db === 'undefined' || !window.db) { showFatalError('Supabase ما تحمّل'); return; }
      const sessionRes = await window.db.auth.getSession();
      const session = sessionRes && sessionRes.data && sessionRes.data.session;
      if (!session || !session.user) { window.location.replace('index.html'); return; }
      currentUser = session.user;
      const initial = (currentUser.email || '?').charAt(0).toUpperCase();
      const avatarEl = document.getElementById('userAvatar');
      if (avatarEl) avatarEl.textContent = initial;
      await loadAllData();
      if (!getMyMemberId()) {
        var me = findMeAsMember();
        if (me) setMyMemberId(me.id);
      }
      switchTab('members');
    } catch (err) {
      showFatalError('فشل التحميل: ' + (err && err.message ? err.message : 'خطأ'));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
