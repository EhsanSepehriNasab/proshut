document.addEventListener('DOMContentLoaded', function () {

  // ── Preloader ──
  const preloader = document.getElementById('preloader');
  if (preloader) {
    window.addEventListener('load', () => preloader.classList.add('hide'));
    setTimeout(() => preloader.classList.add('hide'), 2500);
  }

  // ── AOS (first load only) ──
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 800, once: true, offset: 80 });
  }

  // ── Sticky Navbar (one-time bind) ──
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('mainNavbar');
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 100);
    const btt = document.getElementById('backToTop');
    if (btt) btt.classList.toggle('visible', window.scrollY > 350);
    const stb = document.getElementById('scrollTopBtn');
    if (stb) stb.classList.toggle('visible', window.scrollY > 350);
  });

  // ── Back to Top (delegated) ──
  document.addEventListener('click', function (e) {
    if (e.target.closest('#backToTop') || e.target.closest('#scrollTopBtn')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // ── Category toggle (delegated) ──
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.cat-toggle');
    if (!btn) return;
    var li = btn.closest('li');
    var subList = li.querySelector('.subcategory-list');
    var icon = btn.querySelector('i');
    if (!subList) return;
    if (subList.style.display === 'none' || !subList.style.display) {
      subList.style.display = 'block';
      icon.className = 'fas fa-chevron-up';
    } else {
      subList.style.display = 'none';
      icon.className = 'fas fa-chevron-down';
    }
  });

  // ── Newsletter (delegated) ──
  document.addEventListener('submit', function (e) {
    const form = e.target.closest('#newsletterForm');
    if (!form) return;
    e.preventDefault();
    const email = form.querySelector('input[name="email"]').value;
    const msgEl = document.getElementById('newsletterMsg');
    fetch('/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(r => r.json())
      .then(data => {
        msgEl.textContent = data.msg;
        msgEl.style.color = data.ok ? '#90EE90' : '#FFB3B3';
        if (data.ok) form.reset();
      })
      .catch(() => {
        msgEl.textContent = 'خطا در ارتباط با سرور';
        msgEl.style.color = '#FFB3B3';
      });
  });

  // ── Lightbox (delegated) ──
  document.addEventListener('click', function (e) {
    // Open lightbox
    var zoomEl = e.target.closest('[data-lightbox]');
    if (zoomEl) {
      var modal = document.getElementById('lightboxModal');
      var img = document.getElementById('lightboxImg');
      if (modal && img) {
        img.src = zoomEl.getAttribute('data-lightbox');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
      return;
    }
    // Close lightbox
    var modal = document.getElementById('lightboxModal');
    if (modal && modal.style.display === 'flex' && (e.target === modal || e.target.closest('#lightboxModal button'))) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      return;
    }
    // Gallery thumbnail click
    var thumb = e.target.closest('.gallery-thumb');
    if (thumb) {
      var idx = parseInt(thumb.getAttribute('data-slide'));
      var galEl = document.getElementById('productGallery');
      if (galEl && !isNaN(idx)) {
        var carousel = bootstrap.Carousel.getInstance(galEl) || new bootstrap.Carousel(galEl);
        carousel.to(idx);
        document.querySelectorAll('.gallery-thumb').forEach(function (t) { t.style.borderColor = 'var(--border)'; });
        thumb.style.borderColor = 'var(--primary)';
      }
      return;
    }
  });

  // ── Star rating (delegated) ──
  document.addEventListener('mouseover', function (e) {
    var label = e.target.closest('.star-label');
    if (!label) return;
    var labels = Array.from(document.querySelectorAll('.star-label'));
    var idx = labels.indexOf(label);
    labels.forEach(function (l, i) { l.style.color = i <= idx ? '#f57f17' : '#ddd'; });
  });
  document.addEventListener('click', function (e) {
    var label = e.target.closest('.star-label');
    if (!label) return;
    var labels = Array.from(document.querySelectorAll('.star-label'));
    var idx = labels.indexOf(label);
    labels.forEach(function (l, i) { l.style.color = i <= idx ? '#f57f17' : '#ddd'; });
  });
  document.addEventListener('mouseout', function (e) {
    var rating = e.target.closest('.star-rating');
    if (!rating || rating.contains(e.relatedTarget)) return;
    var checked = document.querySelector('input[name="rating"]:checked');
    var val = checked ? parseInt(checked.value) : 5;
    document.querySelectorAll('.star-label').forEach(function (l, i) { l.style.color = i < val ? '#f57f17' : '#ddd'; });
  });

  // ── Init dynamic widgets (swipers etc) ──
  initDynamicWidgets();

  // ══════════════════════════════════
  // ── SPA Navigation
  // ══════════════════════════════════
  var navigating = false;
  var loader = document.getElementById('topLoader');

  function showLoader() {
    loader.classList.remove('done', 'hide');
    loader.style.width = '0';
    void loader.offsetWidth;
    loader.classList.add('loading');
  }

  function finishLoader() {
    loader.classList.remove('loading');
    loader.classList.add('done');
    setTimeout(function () { loader.classList.add('hide'); }, 300);
    setTimeout(function () {
      loader.classList.remove('done', 'hide');
      loader.style.width = '0';
    }, 700);
  }

  function isLocalLink(a) {
    if (!a.href || a.target === '_blank' || a.hasAttribute('download')) return false;
    try {
      var url = new URL(a.href, location.origin);
      if (url.origin !== location.origin) return false;
      if (url.pathname.startsWith('/admin')) return false;
      if (/\.(pdf|zip|jpg|png|svg|xml|txt)$/i.test(url.pathname)) return false;
      return true;
    } catch (e) { return false; }
  }

  function isProductsPartialNav(url) {
    try {
      var target = new URL(url, location.origin);
      var current = new URL(location.href, location.origin);
      return target.pathname === '/products' && current.pathname === '/products';
    } catch (e) { return false; }
  }

  function navigateTo(url, pushState, forceFullSwap) {
    if (navigating) return;
    navigating = true;
    var partial = !forceFullSwap && isProductsPartialNav(url);
    showLoader();

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        function doSwap() {
          document.title = doc.title;

          if (partial) {
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Swap sidebar, breadcrumb, header/pills instantly (no animation)
            var newSidebar = doc.querySelector('.sidebar-widget');
            var oldSidebar = document.querySelector('.sidebar-widget');
            if (newSidebar && oldSidebar) oldSidebar.replaceWith(newSidebar);

            var newBread = doc.querySelector('.header-breadcrumb');
            var oldBread = document.querySelector('.header-breadcrumb');
            if (newBread && oldBread) oldBread.replaceWith(newBread);

            // Swap the products header (title, count, pills) instantly
            var newArea = doc.getElementById('productsArea');
            var oldArea = document.getElementById('productsArea');
            if (newArea && oldArea) {
              // Get the header part (everything before productCards)
              var newHeader = newArea.querySelector('.mb-3');
              var oldHeader = oldArea.querySelector('.mb-3');
              if (newHeader && oldHeader) oldHeader.replaceWith(newHeader);

              // Animate only the product cards
              var newCards = doc.getElementById('productCards');
              var oldCards = document.getElementById('productCards');
              if (newCards && oldCards) {
                newCards.style.opacity = '0';
                newCards.style.transition = 'opacity 0.3s ease';
                oldCards.replaceWith(newCards);
                requestAnimationFrame(function () { newCards.style.opacity = '1'; });
              }
            }
          } else {
            // Clean old AOS state
            document.querySelectorAll('.aos-init').forEach(function (el) {
              el.classList.remove('aos-init', 'aos-animate');
              el.removeAttribute('style');
            });

            // Swap sections
            swap('.site-header-wrap', doc);
            swap('main', doc);
            swap('.newsletter-section', doc);
            swap('.mobile-bottom-nav', doc);

            window.scrollTo(0, 0);

            // Re-grab loader ref (header was swapped)
            loader = document.getElementById('topLoader');

            // Re-init Bootstrap components on new DOM
            document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(function (el) {
              new bootstrap.Dropdown(el);
            });
            document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(function (el) {
              new bootstrap.Collapse(el, { toggle: false });
            });

            // Re-init AOS fresh for new content
            if (typeof AOS !== 'undefined') {
              AOS.init({ duration: 800, once: true, offset: 80 });
            }
          }

          var newMeta = doc.querySelector('meta[name="description"]');
          var oldMeta = document.querySelector('meta[name="description"]');
          if (newMeta && oldMeta) oldMeta.content = newMeta.content;

          if (pushState) history.pushState({}, '', url);

          initDynamicWidgets();
          finishLoader();
          navigating = false;
        }

        doSwap();
      })
      .catch(function () {
        finishLoader();
        navigating = false;
        window.location.href = url;
      });
  }

  function swap(selector, doc) {
    var newEl = doc.querySelector(selector);
    var oldEl = document.querySelector(selector);
    if (newEl && oldEl) oldEl.replaceWith(newEl);
  }

  // Intercept link clicks (delegated, one-time)
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a || !isLocalLink(a)) return;
    // Let Bootstrap handle dropdown toggles
    if (a.hasAttribute('data-bs-toggle')) return;
    // Let products page handle its own category/subcategory filtering via AJAX
    if (location.pathname === '/products' && a.closest('.category-list, .subcategory-list, #subPills')) return;
    // Let language switcher do a full reload to set session
    if (a.classList.contains('lang-link')) return;
    var url = new URL(a.href, location.origin);
    if (url.pathname === location.pathname && url.hash) return;
    if (a.href === location.href) return;
    e.preventDefault();
    navigateTo(a.href, true);
  });

  // Intercept GET form submissions (delegated, one-time)
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.id === 'newsletterForm') return; // handled above
    if (form.method && form.method.toLowerCase() === 'post') return;
    try {
      var actionUrl = new URL(form.action || location.href, location.origin);
      if (actionUrl.origin !== location.origin) return;
      if (actionUrl.pathname.startsWith('/admin')) return;
    } catch (err) { return; }
    e.preventDefault();
    var params = new URLSearchParams(new FormData(form)).toString();
    navigateTo(form.action + '?' + params, true);
  });

  // Back/forward (one-time) — always full swap
  window.addEventListener('popstate', function () {
    navigateTo(location.href, false, true);
  });
});

// ── Init swipers & other per-page widgets ──
function initDynamicWidgets() {
  if (document.querySelector('.heroSwiper')) {
    new Swiper('.heroSwiper', {
      loop: true,
      autoplay: { delay: 5000, disableOnInteraction: false },
      pagination: { el: '.swiper-pagination', clickable: true },
      navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
      effect: 'fade',
      fadeEffect: { crossFade: true },
      speed: 800,
    });
  }
  if (document.querySelector('.brandsSwiper')) {
    new Swiper('.brandsSwiper', {
      loop: true,
      autoplay: { delay: 2500, disableOnInteraction: false },
      slidesPerView: 2,
      spaceBetween: 20,
      breakpoints: {
        576: { slidesPerView: 3 },
        768: { slidesPerView: 4 },
        992: { slidesPerView: 5 },
        1200: { slidesPerView: 6 },
      },
    });
  }

  // Product gallery carousel init + thumbnail sync
  var galEl = document.getElementById('productGallery');
  if (galEl) {
    new bootstrap.Carousel(galEl, { ride: false });
    galEl.addEventListener('slid.bs.carousel', function (e) {
      document.querySelectorAll('.gallery-thumb').forEach(function (t, i) {
        t.style.borderColor = i === e.to ? 'var(--primary)' : 'var(--border)';
      });
    });
  }

  // Init star rating display
  var checked = document.querySelector('input[name="rating"]:checked');
  if (checked) {
    var val = parseInt(checked.value);
    document.querySelectorAll('.star-label').forEach(function (l, i) {
      l.style.color = i < val ? '#f57f17' : '#ddd';
    });
  }

  // Showcase scroll buttons
  var scrollLeftBtn = document.getElementById('showcaseScrollLeft');
  var scrollRightBtn = document.getElementById('showcaseScrollRight');
  var showcaseProducts = document.getElementById('showcaseProducts');
  if (scrollLeftBtn && scrollRightBtn && showcaseProducts && !scrollLeftBtn._bound) {
    scrollLeftBtn._bound = true;
    var scrollAmount = 300;
    var isLTR = document.documentElement.dir === 'ltr';

    function updateScrollBtns() {
      var sl = showcaseProducts.scrollLeft;
      var maxScroll = showcaseProducts.scrollWidth - showcaseProducts.clientWidth;
      if (isLTR) {
        // LTR: scrollLeft starts at 0, goes positive
        scrollLeftBtn.style.opacity = sl > 2 ? '1' : '0';
        scrollLeftBtn.style.pointerEvents = sl > 2 ? 'auto' : 'none';
        scrollRightBtn.style.opacity = sl < maxScroll - 2 ? '1' : '0';
        scrollRightBtn.style.pointerEvents = sl < maxScroll - 2 ? 'auto' : 'none';
      } else {
        // RTL: scrollLeft is negative
        scrollRightBtn.style.opacity = sl < 0 ? '1' : '0';
        scrollRightBtn.style.pointerEvents = sl < 0 ? 'auto' : 'none';
        scrollLeftBtn.style.opacity = Math.abs(sl) < maxScroll - 2 ? '1' : '0';
        scrollLeftBtn.style.pointerEvents = Math.abs(sl) < maxScroll - 2 ? 'auto' : 'none';
      }
    }

    scrollRightBtn.style.transition = 'opacity .3s ease';
    scrollLeftBtn.style.transition = 'opacity .3s ease';
    updateScrollBtns();
    showcaseProducts.addEventListener('scroll', updateScrollBtns);

    scrollLeftBtn.addEventListener('click', function () {
      showcaseProducts.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    scrollRightBtn.addEventListener('click', function () {
      showcaseProducts.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    // Auto scroll on mobile to show more products
    if (window.innerWidth <= 575 && showcaseProducts.scrollLeft === 0) {
      setTimeout(function() {
        showcaseProducts.scrollBy({ left: isLTR ? 120 : -120, behavior: 'smooth' });
      }, 800);
    }
  }

  // Stat cards observer
  var statCards = document.querySelectorAll('.stat-card:not(.animate)');
  if (statCards.length) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    statCards.forEach(function (el) { obs.observe(el); });
  }

  // Collapse nav on mobile
  var mainNav = document.getElementById('mainNav');
  if (mainNav && !mainNav._spaBound) {
    mainNav._spaBound = true;
    mainNav.addEventListener('show.bs.collapse', function () { document.body.classList.add('nav-open'); });
    mainNav.addEventListener('hide.bs.collapse', function () { document.body.classList.remove('nav-open'); });

    // Close mobile menu when a non-dropdown nav link or dropdown item is clicked
    mainNav.querySelectorAll('a.nav-link:not(.dropdown-toggle), .dropdown-menu a').forEach(function(link) {
      link.addEventListener('click', function() {
        if (window.innerWidth <= 991) {
          var bsCollapse = bootstrap.Collapse.getInstance(mainNav);
          if (bsCollapse) bsCollapse.hide();
        }
      });
    });
  }
}
