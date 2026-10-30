(function () {
  'use strict';

  const STORAGE_PREFIX = 'qittat_onboarded_v1_';

  const SLIDES = [
    {
      key: 'welcome',
      render: function () {
        return '<div class="ob-illustration">' +
          '<div class="ob-mascot-wrap">' +
            '<div class="ob-sparkle" style="--i:0">✨</div>' +
            '<div class="ob-sparkle" style="--i:1">✨</div>' +
            '<div class="ob-sparkle" style="--i:2">✨</div>' +
            '<div class="ob-sparkle" style="--i:3">✨</div>' +
            '<div class="ob-mascot">🐱</div>' +
          '</div>' +
        '</div>' +
        '<h2 class="ob-title">هلا بك في قطة!</h2>' +
        '<p class="ob-desc">أسهل طريقة لتقسيم مصاريف الاستراحة بينك وبين ربّعك</p>';
      }
    },
    {
      key: 'members',
      render: function () {
        return '<div class="ob-illustration">' +
          '<div class="ob-members-wrap">' +
            '<div class="ob-avatar" style="--i:0; background:#818cf825; color:#818cf8">😎</div>' +
            '<div class="ob-avatar" style="--i:1; background:#c084fc25; color:#c084fc">🎮</div>' +
            '<div class="ob-avatar" style="--i:2; background:#f472b625; color:#f472b6">🎯</div>' +
            '<div class="ob-avatar" style="--i:3; background:#34d39925; color:#34d399">🎸</div>' +
          '</div>' +
        '</div>' +
        '<h2 class="ob-title">ضف ربّعك</h2>' +
        '<p class="ob-desc">ضف أعضاء الاستراحة مرة وحدة — واستخدمهم في كل قطة</p>';
      }
    },
    {
      key: 'split',
      render: function () {
        return '<div class="ob-illustration">' +
          '<div class="ob-split-wrap">' +
            '<div class="ob-bill">100<span>ر.س</span></div>' +
            '<div class="ob-part" style="--i:0">33.33</div>' +
            '<div class="ob-part" style="--i:1">33.33</div>' +
            '<div class="ob-part" style="--i:2">33.34</div>' +
          '</div>' +
        '</div>' +
        '<h2 class="ob-title">اقسم القطات</h2>' +
        '<p class="ob-desc">سجل من دفع، ومن كان معه، والتطبيق يقسم المبلغ تلقائياً</p>';
      }
    },
    {
      key: 'settle',
      render: function () {
        return '<div class="ob-illustration">' +
          '<div style="position:relative; display:flex; align-items:center; justify-content:center;">' +
            '<div class="ob-coins">💰</div>' +
            '<div class="ob-coins">💵</div>' +
            '<div class="ob-coins">🪙</div>' +
            '<div class="ob-coins">💎</div>' +
            '<div class="ob-check-wrap">' +
              '<svg viewBox="0 0 100 100">' +
                '<path d="M25,50 L45,70 L75,30" stroke-linecap="round" stroke-linejoin="round"/>' +
              '</svg>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<h2 class="ob-title">سدّد بسهولة</h2>' +
        '<p class="ob-desc">التطبيق يحسب لك بالضبط كم يدفع كل واحد — بدون فوضى</p>';
      }
    },
    {
      key: 'ready',
      render: function () {
        return '<div class="ob-illustration">' +
          '<div class="ob-rocket-wrap">' +
            '<div class="ob-rocket">🚀</div>' +
            '<div class="ob-fire">🔥</div>' +
          '</div>' +
        '</div>' +
        '<h2 class="ob-title">يلا نبدأ!</h2>' +
        '<p class="ob-desc">كل شي جاهز — ابدأ بضف أعضاء استراحتك</p>';
      }
    }
  ];

  let currentIndex = 0;
  let user = null;
  let isOpen = false;

  function haptic(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms || 10); } catch (e) {} }
  }

  function getUserId() {
    try {
      if (user && user.id) return user.id;
      // fallback: read from localStorage session
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.indexOf('sb-') === 0 && k.indexOf('auth-token') !== -1) {
          try {
            var val = JSON.parse(localStorage.getItem(k));
            if (val && val.user && val.user.id) return val.user.id;
          } catch (e) {}
        }
      }
    } catch (e) {}
    return null;
  }

  function shouldShow(u) {
    if (!u) return false;
    var key = STORAGE_PREFIX + u.id;
    if (localStorage.getItem(key) === 'done') return false;
    if (window.location.search.indexOf('onboarding=1') !== -1) return true;
    if (window.location.search.indexOf('onboarding') !== -1) return true;
    return false;
  }

  function buildSlides() {
    var container = document.getElementById('obSlides');
    if (!container) return;
    container.innerHTML = SLIDES.map(function (s, i) {
      return '<div class="ob-slide' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">' +
        s.render() +
      '</div>';
    }).join('');
  }

  function buildDots() {
    var dots = document.getElementById('obDots');
    if (!dots) return;
    dots.innerHTML = SLIDES.map(function (_, i) {
      return '<div class="ob-dot' + (i === 0 ? ' active' : '') + '" data-dot="' + i + '"></div>';
    }).join('');
  }

  function updateProgress() {
    var fill = document.getElementById('obProgress');
    if (fill) {
      var pct = ((currentIndex + 1) / SLIDES.length) * 100;
      fill.style.width = pct + '%';
    }
  }

  function updateDots() {
    document.querySelectorAll('.ob-dot').forEach(function (dot, i) {
      dot.classList.toggle('active', i === currentIndex);
    });
  }

  function updateButton() {
    var btn = document.getElementById('obNext');
    if (!btn) return;
    var isLast = currentIndex === SLIDES.length - 1;
    btn.textContent = isLast ? 'يلا نبدأ 🚀' : 'التالي';
    btn.classList.toggle('finish', isLast);
  }

  function goTo(index, dir) {
    if (index < 0 || index >= SLIDES.length) return;
    if (index === currentIndex) return;
    dir = dir || (index > currentIndex ? 'next' : 'prev');

    var slides = document.querySelectorAll('.ob-slide');
    var current = slides[currentIndex];
    var target = slides[index];
    if (!current || !target) return;

    current.classList.remove('active');
    current.classList.add(dir === 'next' ? 'prev' : 'next');
    // reset all other slides
    slides.forEach(function (s, i) {
      if (i !== currentIndex && i !== index) {
        s.classList.remove('active', 'prev', 'next');
      }
    });
    // force reflow
    void target.offsetWidth;
    target.classList.remove('prev', 'next');
    target.classList.add('active');

    currentIndex = index;
    updateProgress();
    updateDots();
    updateButton();
    haptic(8);
  }

  function fireConfetti() {
    var colors = ['#818cf8','#c084fc','#f472b6','#34d399','#fbbf24','#60a5fa','#fb923c'];
    var count = 80;
    for (var i = 0; i < count; i++) {
      (function (idx) {
        setTimeout(function () {
          var conf = document.createElement('div');
          conf.className = 'confetti-piece';
          conf.style.left = (Math.random() * 100) + '%';
          conf.style.background = colors[Math.floor(Math.random() * colors.length)];
          conf.style.width = (6 + Math.random() * 8) + 'px';
          conf.style.height = (8 + Math.random() * 10) + 'px';
          conf.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
          conf.style.animationDelay = (Math.random() * 0.4) + 's';
          conf.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
          document.body.appendChild(conf);
          setTimeout(function () { conf.remove(); }, 3500);
        }, idx * 15);
      })(i);
    }
  }

  function close() {
    var overlay = document.getElementById('onboarding');
    if (!overlay) return;
    // save flag
    var uid = getUserId();
    if (uid) {
      try { localStorage.setItem(STORAGE_PREFIX + uid, 'done'); } catch (e) {}
    }
    // remove URL param
    try {
      var clean = window.location.href.replace(/[?&]onboarding(=1)?/g, '');
      if (clean.indexOf('?') === clean.length - 1) clean = clean.slice(0, -1);
      window.history.replaceState({}, '', clean);
    } catch (e) {}
    // fade out
    overlay.style.transition = 'opacity 0.4s, transform 0.4s';
    overlay.style.opacity = '0';
    overlay.style.transform = 'scale(1.05)';
    setTimeout(function () {
      overlay.hidden = true;
      overlay.style.opacity = '';
      overlay.style.transform = '';
      isOpen = false;
    }, 400);
    haptic(20);
  }

  function nextSlide() {
    if (currentIndex >= SLIDES.length - 1) {
      // finish
      fireConfetti();
      haptic(30);
      setTimeout(close, 500);
      return;
    }
    goTo(currentIndex + 1, 'next');
  }

  function prevSlide() {
    if (currentIndex <= 0) return;
    goTo(currentIndex - 1, 'prev');
  }

  function initSwipe() {
    var container = document.getElementById('obSlides');
    if (!container) return;
    var startX = 0, startY = 0, tracking = false;

    container.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches[0]) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    container.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      if (!e.changedTouches || !e.changedTouches[0]) return;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 50) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) nextSlide(); // swipe left = next (RTL)
      else prevSlide(); // swipe right = prev
    }, { passive: true });
  }

  function init() {
    // find user
    var tryUser = function () {
      try {
        if (window.db && window.db.auth) {
          window.db.auth.getSession().then(function (res) {
            var s = res && res.data && res.data.session;
            if (s && s.user) {
              user = s.user;
              if (shouldShow(user)) show();
            }
          }).catch(function () {});
        }
      } catch (e) {}
    };
    tryUser();
  }

  function show() {
    if (isOpen) return;
    var overlay = document.getElementById('onboarding');
    if (!overlay) {
      console.warn('⚠️ onboarding element مفقود في HTML');
      return;
    }
    isOpen = true;
    currentIndex = 0;
    buildSlides();
    buildDots();
    updateProgress();
    updateDots();
    updateButton();
    overlay.hidden = false;

    var nextBtn = document.getElementById('obNext');
    var skipBtn = document.getElementById('obSkip');
    if (nextBtn) nextBtn.onclick = nextSlide;
    if (skipBtn) skipBtn.onclick = close;

    initSwipe();

    // keyboard
    document.addEventListener('keydown', function obKey(e) {
      if (!isOpen) { document.removeEventListener('keydown', obKey); return; }
      if (e.key === 'ArrowLeft') nextSlide();
      else if (e.key === 'ArrowRight') prevSlide();
      else if (e.key === 'Escape') close();
    });

    console.log('🎉 Onboarding ظهر —', SLIDES.length, 'شرائح');
  }

  // API عام
  window.QittatOnboarding = {
    shouldShow: shouldShow,
    show: function (u) { user = u || user; show(); },
    close: close
  };

  // بدء
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 300);
  }
})();