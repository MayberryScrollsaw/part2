/*
  ============================================================
  MAYBERRY SCROLLSAW — script.js
  ============================================================
  PURPOSE:
    Provides all interactive behavior for the Mayberry Scrollsaw
    home page, bridging index.html structure with styles.css
    class-based animations and state.

  RESPONSIBILITIES:
    1. Header shrink on scroll         → toggles .scrolled
    2. Hamburger / mobile nav toggle   → toggles .is-open
    3. Scroll-reveal animations        → adds .is-visible via
                                         IntersectionObserver
    4. Hero entrance animation         → adds .reveal on load
    5. Gallery lightbox                → open / close / keyboard
    6. Newsletter form                 → validation + success msg
    7. Footer year                     → inserts current year
  ============================================================
*/

(function () {
    'use strict';


    /* ===========================================================
       1. HEADER — shrink on scroll
       CSS watches for .scrolled on #site-header to reduce height
       and add a drop shadow.
    =========================================================== */
    const siteHeader = document.getElementById('site-header');

    function onScroll() {
        if (window.scrollY > 10) {
            siteHeader.classList.add('scrolled');
        } else {
            siteHeader.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // Run once on load in case page is already scrolled


    /* ===========================================================
       2. HAMBURGER / MOBILE NAV TOGGLE
       Toggles .is-open on #main-nav and updates aria-expanded
       on the button. Closes the nav when a nav link is clicked.
    =========================================================== */
    const hamburger = document.getElementById('hamburger');
    const mainNav = document.getElementById('main-nav');

    function openNav() {
        mainNav.classList.add('is-open');
        hamburger.setAttribute('aria-expanded', 'true');
        hamburger.classList.add('is-active');
    }

    function closeNav() {
        mainNav.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.classList.remove('is-active');
    }

    hamburger.addEventListener('click', function () {
        if (mainNav.classList.contains('is-open')) {
            closeNav();
        } else {
            openNav();
        }
    });

    // Close nav when any nav link is clicked (smooth-scroll to section)
    mainNav.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeNav);
    });

    // Close nav on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mainNav.classList.contains('is-open')) {
            closeNav();
            hamburger.focus();
        }
    });

    // Close nav when clicking outside of header
    document.addEventListener('click', function (e) {
        if (
            mainNav.classList.contains('is-open') &&
            !siteHeader.contains(e.target)
        ) {
            closeNav();
        }
    });


    /* ===========================================================
       3. SCROLL-REVEAL ANIMATIONS
       Elements with .scroll-reveal start at opacity:0 / offset.
       IntersectionObserver adds .is-visible once they enter the
       viewport. Cards get a staggered transition-delay.
    =========================================================== */
    const revealEls = document.querySelectorAll('.scroll-reveal');

    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        revealObserver.unobserve(entry.target); // Animate once
                    }
                });
            },
            { threshold: 0.12 }
        );

        // Stagger sibling cards / gallery items
        document.querySelectorAll('.cards-grid, .gallery-grid').forEach(function (grid) {
            grid.querySelectorAll('.scroll-reveal').forEach(function (child, i) {
                child.style.transitionDelay = (i * 90) + 'ms';
            });
        });

        revealEls.forEach(function (el) {
            revealObserver.observe(el);
        });

    } else {
        // Fallback: make everything visible if IO isn't supported
        revealEls.forEach(function (el) {
            el.classList.add('is-visible');
        });
    }


    /* ===========================================================
       4. HERO ENTRANCE ANIMATION
       The .hero-content has class "reveal" in the HTML but the
       CSS transition needs a tick to register. We add the class
       after a brief delay so the entrance actually plays.
    =========================================================== */
    const heroContent = document.querySelector('.hero-content');

    if (heroContent) {
        // Remove the class first so we control the timing
        heroContent.classList.remove('reveal');
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                heroContent.classList.add('reveal');
            });
        });
    }


    /* ===========================================================
       5. GALLERY LIGHTBOX
       Clicking a .gallery-btn opens the lightbox with the full
       image + caption. Close via the ✕ button, clicking the
       backdrop, or pressing Escape.
    =========================================================== */
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxClose = document.getElementById('lightbox-close')
        || document.querySelector('.lightbox-close');

    function openLightbox(imgSrc, imgAlt, caption) {
        if (!lightbox || !lightboxImg) return;
        lightboxImg.src = imgSrc;
        lightboxImg.alt = imgAlt;
        if (lightboxCaption) lightboxCaption.textContent = caption;
        lightbox.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
        if (lightboxClose) lightboxClose.focus();
    }

    function closeLightbox() {
        lightbox.setAttribute('hidden', '');
        lightboxImg.src = '';
        document.body.style.overflow = '';
    }

    // Open on gallery button click
    document.querySelectorAll('.gallery-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const img = btn.querySelector('img');
            const figure = btn.closest('figure');
            const caption = figure ? figure.querySelector('figcaption')?.textContent : '';
            if (img) {
                openLightbox(img.src, img.alt, caption || '');
            }
        });
    });

    // Close button
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }

    // Close on backdrop click (but not on the image itself)
    if (lightbox) {
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
    }
    // Open on thumbnail click (.lightbox-trigger links)
    document.querySelectorAll('.lightbox-trigger').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const img = link.querySelector('img');
            openLightbox(link.dataset.img, img ? img.alt : '', '');
        });
    });
    // Close on Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && lightbox && !lightbox.hasAttribute('hidden')) {
            closeLightbox();
        }
    });


    /* ===========================================================
       6. NEWSLETTER FORM
       Basic client-side validation. On valid submit, hides the
       form and shows the #nl-success message.
       (No real back-end — extend this to POST to your API.)
    =========================================================== */
    const newsletterForm = document.getElementById('newsletter-form');
    const nlSuccess = document.getElementById('nl-success');

    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const nameInput = newsletterForm.querySelector('#nl-name');
            const emailInput = newsletterForm.querySelector('#nl-email');
            let valid = true;

            // Simple presence + format checks
            [nameInput, emailInput].forEach(function (input) {
                input.style.borderColor = '';
            });

            if (!nameInput.value.trim()) {
                nameInput.style.borderColor = '#9b3a2e'; // --red-barn
                nameInput.focus();
                valid = false;
            }

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(emailInput.value.trim())) {
                emailInput.style.borderColor = '#9b3a2e';
                if (valid) emailInput.focus();
                valid = false;
            }

            if (!valid) return;

            // Success path
            newsletterForm.style.display = 'none';
            if (nlSuccess) {
                nlSuccess.removeAttribute('hidden');
                nlSuccess.focus();
            }
        });
    }


    /* ===========================================================
       7. FOOTER YEAR
       Keeps the copyright year current without manual editing.
    =========================================================== */
    const footerYear = document.getElementById('footer-year');
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }


})(); // End IIFE