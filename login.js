(function () {
  'use strict';

  var RESERVED_NAMES = ['guest', 'admin', 'root', 'system'];
  var USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
  var toastTimer = null;

  function toast(msg, type) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + (type || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast ' + (type || ''); }, 2600);
  }

  function showError(id, msg) {
    var inp = document.getElementById(id);
    var err = document.getElementById(id + 'Error');
    if (inp) inp.classList.add('error');
    if (err) { err.textContent = msg; err.classList.add('show'); }
  }

  function clearError(id) {
    var inp = document.getElementById(id);
    var err = document.getElementById(id + 'Error');
    if (inp) inp.classList.remove('error');
    if (err) { err.textContent = ''; err.classList.remove('show'); }
  }

  function setLoading(btnId, loading, txt) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    var t = btn.querySelector('.btn-text');
    var s = btn.querySelector('.btn-spinner');
    btn.disabled = loading;
    if (loading) { if (t) t.textContent = 'لحظة…'; if (s) s.hidden = false; }
    else { if (t) t.textContent = txt; if (s) s.hidden = true; }
  }

  function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    document.querySelectorAll('.auth-form').forEach(function (f) { f.classList.toggle('active', f.id === tab + 'Form'); });
    ['loginUsername','loginPassword','signupUsername','signupPassword','signupConfirm'].forEach(clearError);
    var first = document.querySelector('#' + tab + 'Form input');
    if (first) setTimeout(function () { first.focus(); }, 250);
  }

  function initPasswordToggles() {
    var eo = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    var ec = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    document.querySelectorAll('.toggle-password').forEach(function (btn) {
      btn.onclick = function () {
        var t = document.getElementById(btn.dataset.for); if (!t) return;
        var p = t.type === 'password'; t.type = p ? 'text' : 'password';
        btn.innerHTML = p ? ec : eo; t.focus();
      };
    });
  }

  function enforceEnglish(id) {
    var inp = document.getElementById(id); if (!inp) return;
    inp.addEventListener('input', function () {
      var c = inp.value.replace(/[^A-Za-z0-9_]/g, '');
      if (c !== inp.value) inp.value = c;
      clearError(id);
    });
  }

  function initPasswordStrength() {
    var pwd = document.getElementById('signupPassword'); var wrap = document.getElementById('signupStrength');
    if (!pwd || !wrap) return;
    var bar = wrap.querySelector('.strength-bar span'); var txt = wrap.querySelector('.strength-text');
    pwd.addEventListener('input', function () {
      var v = pwd.value; clearError('signupPassword');
      if (!v) { wrap.classList.remove('show'); return; }
      wrap.classList.add('show');
      var s = 0;
      if (v.length >= 6) s++; if (v.length >= 10) s++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^a-zA-Z0-9]/.test(v)) s++;
      var L = [{ w: '20%', c: '#f87171', t: 'ضعيف مرة' }, { w: '40%', c: '#f87171', t: 'ضعيف' }, { w: '60%', c: '#fbbf24', t: 'عادي' }, { w: '80%', c: '#fbbf24', t: 'زين' }, { w: '100%', c: '#34d399', t: 'قوي' }];
      var lv = L[Math.min(s, L.length - 1)];
      bar.style.width = lv.w; bar.style.background = lv.c; txt.textContent = lv.t; txt.style.color = lv.c;
    });
  }

  function validateLogin() {
    clearError('loginUsername'); clearError('loginPassword');
    var ok = true;
    var u = document.getElementById('loginUsername').value.trim();
    var p = document.getElementById('loginPassword').value;
    if (!u) { showError('loginUsername', 'اكتب اسمك'); ok = false; }
    else if (!USERNAME_REGEX.test(u)) { showError('loginUsername', 'الاسم مو صحيح'); ok = false; }
    if (!p) { showError('loginPassword', 'اكتب الباسورد'); ok = false; }
    return ok;
  }

  function validateSignup() {
    clearError('signupUsername'); clearError('signupPassword'); clearError('signupConfirm');
    var ok = true;
    var u = document.getElementById('signupUsername').value.trim();
    var p = document.getElementById('signupPassword').value;
    var c = document.getElementById('signupConfirm').value;
    if (!u) { showError('signupUsername', 'اكتب اسمك'); ok = false; }
    else if (!USERNAME_REGEX.test(u)) { showError('signupUsername', '3-20 حرف إنجليزي، أرقام، أو _ بس'); ok = false; }
    else if (RESERVED_NAMES.indexOf(u.toLowerCase()) !== -1) { showError('signupUsername', 'هذا الاسم محجوز'); ok = false; }
    if (!p) { showError('signupPassword', 'اكتب الباسورد'); ok = false; }
    else if (p.length < 6) { showError('signupPassword', 'الباسورد 6 أحرف على الأقل'); ok = false; }
    if (!c) { showError('signupConfirm', 'أكد الباسورد'); ok = false; }
    else if (c !== p) { showError('signupConfirm', 'الباسوردين ما يتطابقون'); ok = false; }
    return ok;
  }

  function handleLogin(e) {
    e.preventDefault();
    if (!validateLogin()) return;
    var u = document.getElementById('loginUsername').value.trim();
    var p = document.getElementById('loginPassword').value;
    var email = u.toLowerCase() + '@qittat.app';
    setLoading('loginSubmitBtn', true, 'دخول');

    var promise;
    try { promise = window.db.auth.signInWithPassword({ email: email, password: p }); }
    catch (syncErr) { console.error('sync:', syncErr); setLoading('loginSubmitBtn', false, 'دخول'); toast('خطأ غير متوقع', 'error'); return; }

    promise.then(function (result) {
      var error = result && result.error;
      var data = result && result.data;
      if (error) {
        console.error('signIn:', error.message);
        setLoading('loginSubmitBtn', false, 'دخول');
        var msg = 'الباسورد غلط أو الحساب غير موجود';
        if (error.message && error.message.toLowerCase().indexOf('email not confirmed') !== -1) msg = 'الحساب ما تأكد. تواصل مع المسؤول.';
        else if (error.message && error.message.toLowerCase().indexOf('invalid') !== -1) msg = 'الاسم أو الباسورد غلط';
        showError('loginPassword', msg);
        toast(msg, 'error');
        return;
      }
      console.log('✅ دخول:', data && data.user && data.user.email);
      toast('هلا ' + u + ' 👋', 'success');
      setTimeout(function () { window.location.replace('Qtah.html'); }, 400);
    }).catch(function (err) {
      console.error('catch:', err);
      setLoading('loginSubmitBtn', false, 'دخول');
      toast('ما قدرنا نتصل بالسيرفر', 'error');
    });
  }

  function handleSignup(e) {
    e.preventDefault();
    if (!validateSignup()) return;
    var u = document.getElementById('signupUsername').value.trim();
    var p = document.getElementById('signupPassword').value;
    var email = u.toLowerCase() + '@qittat.app';
    setLoading('signupSubmitBtn', true, 'سوّ الحساب');

    var promise;
    try { promise = window.db.auth.signUp({ email: email, password: p, options: { data: { display_name: u } } }); }
    catch (syncErr) { console.error('sync:', syncErr); setLoading('signupSubmitBtn', false, 'سوّ الحساب'); toast('خطأ غير متوقع', 'error'); return; }

    promise.then(function (result) {
      var error = result && result.error;
      var data = result && result.data;
      if (error) {
        console.error('signUp:', error.message);
        setLoading('signupSubmitBtn', false, 'سوّ الحساب');
        var msg = 'الاسم مأخوذ من قبل أو حدث خطأ';
        if (error.message && error.message.toLowerCase().indexOf('already registered') !== -1) msg = 'هذا الاسم مأخوذ، جرّب اسم ثاني';
        else if (error.message && error.message.toLowerCase().indexOf('password') !== -1) msg = 'الباسورد ضعيف، جرّب أقوى';
        showError('signupUsername', msg);
        toast(msg, 'error');
        return;
      }
      if (data && data.user && !data.session) {
        console.warn('⚠️ تأكيد الإيميل مفعّل');
        setLoading('signupSubmitBtn', false, 'سوّ الحساب');
        toast('الحساب اتعمل ✓ — فعّل "Confirm email = OFF" من Supabase', 'success');
        return;
      }
      console.log('✅ حساب جديد:', data && data.user && data.user.email);
      toast('تم سوّ الحساب ✓', 'success');
      // ← التوجيه مع parameter للـ onboarding
      setTimeout(function () { window.location.replace('Qtah.html?onboarding=1'); }, 500);
    }).catch(function (err) {
      console.error('catch:', err);
      setLoading('signupSubmitBtn', false, 'سوّ الحساب');
      toast('ما قدرنا نتصل بالسيرفر', 'error');
    });
  }

  function initEvents() {
    document.querySelectorAll('.auth-tab').forEach(function (t) { t.onclick = function () { switchTab(t.dataset.tab); }; });
    document.querySelectorAll('[data-switch]').forEach(function (l) { l.onclick = function (e) { e.preventDefault(); switchTab(l.dataset.switch); }; });
    var lf = document.getElementById('loginForm'); var sf = document.getElementById('signupForm');
    if (lf) lf.addEventListener('submit', handleLogin);
    if (sf) sf.addEventListener('submit', handleSignup);
    initPasswordToggles(); enforceEnglish('loginUsername'); enforceEnglish('signupUsername'); initPasswordStrength();
    ['loginUsername','loginPassword','signupUsername','signupPassword','signupConfirm'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('input', function () { clearError(id); });
    });
    var forgot = document.getElementById('forgotLink');
    if (forgot) forgot.onclick = function (e) { e.preventDefault(); toast('كلّم المسؤول لإعادة تعيين الباسورد', 'error'); };
    console.log('✅ صفحة الدخول جاهزة');
  }

  function checkSession() {
    if (window.location.href.indexOf('logged_out=1') !== -1) {
      console.log('👋 جاي من logout — تجاهل الفحص');
      try {
        var clean = window.location.href.replace(/[?&]logged_out=1/, '');
        if (clean.indexOf('?') === clean.length - 1) clean = clean.slice(0, -1);
        window.history.replaceState({}, '', clean);
      } catch (e) {}
      return;
    }
    if (typeof window.db === 'undefined' || !window.db) return;
    try {
      window.db.auth.getSession().then(function (result) {
        var session = result && result.data && result.data.session;
        if (session) {
          console.log('✅ فيه جلسة — تحويل لـ Qtah');
          window.location.replace('Qtah.html');
        }
      }).catch(function (e) { console.warn('getSession:', e); });
    } catch (e) { console.warn('getSession sync:', e); }
  }

  function start() {
    try { initEvents(); } catch (e) { console.error('initEvents:', e); }
    checkSession();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();