(function () {
  "use strict";

  // Tell CSS that JavaScript is running so reveal animations can start hidden.
  document.documentElement.classList.add("js");

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Mobile menu ---------- */
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    nav.classList.toggle("is-open", open);
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });

    // Close after choosing a link
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });

    // Close with Escape and return focus to the button
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });

    // Reset when the layout switches back to desktop
    window.matchMedia("(min-width: 1081px)").addEventListener("change", function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- Header shadow on scroll ---------- */
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Fade-in sections ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Highlight the nav link for the section in view ---------- */
  var navLinks = document.querySelectorAll(".primary-nav a");
  var sections = Array.prototype.map.call(navLinks, function (a) {
    var href = a.getAttribute("href");
    return href && href.length > 1 && href.charAt(0) === "#" ? document.querySelector(href) : null;
  });

  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          var active = link.getAttribute("href") === "#" + entry.target.id;
          link.classList.toggle("is-active", active);
          if (active) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { if (s) spy.observe(s); });
  }

  /* ---------- Gallery lightbox ---------- */
  var lightbox = document.getElementById("lightbox");
  var galleryItems = Array.prototype.slice.call(document.querySelectorAll(".gallery__item"));
  var current = 0;

  if (lightbox && galleryItems.length) {
    var lbImg = document.getElementById("lightbox-img");
    var lbCaption = document.getElementById("lightbox-caption");

    var showPhoto = function (index) {
      current = (index + galleryItems.length) % galleryItems.length;
      var item = galleryItems[current];
      lbImg.src = item.getAttribute("data-full");
      lbImg.alt = item.querySelector("img").alt;
      lbCaption.textContent = item.getAttribute("data-caption") || "";
    };

    var closeLightbox = function () {
      if (lightbox.open) lightbox.close();
    };

    galleryItems.forEach(function (item, index) {
      item.addEventListener("click", function () {
        showPhoto(index);
        lightbox.showModal();
        document.documentElement.classList.add("lightbox-open");
      });
    });

    lightbox.querySelector(".lightbox__close").addEventListener("click", closeLightbox);
    lightbox.querySelector(".lightbox__nav--prev").addEventListener("click", function () { showPhoto(current - 1); });
    lightbox.querySelector(".lightbox__nav--next").addEventListener("click", function () { showPhoto(current + 1); });

    // Click on the dark area (not the photo) closes the viewer
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) closeLightbox(); });
    lightbox.addEventListener("close", function () { document.documentElement.classList.remove("lightbox-open"); });

    document.addEventListener("keydown", function (e) {
      if (!lightbox.open) return;
      if (e.key === "ArrowLeft") showPhoto(current - 1);
      if (e.key === "ArrowRight") showPhoto(current + 1);
    });
  }

  /* ---------- Contact form ---------- */
  var form = document.getElementById("contact-form");
  if (!form) return;

  var statusEl = document.getElementById("form-status");
  var submitBtn = document.getElementById("submit-btn");
  var pageLoadedAt = Date.now();

  var messages = {
    name: "Please enter your full name (at least 2 characters).",
    email: "Please enter a valid email address.",
    phone: "Please enter a valid phone number, or leave it blank.",
    subject: "Please enter a subject (at least 3 characters).",
    message: "Please write a message of at least 10 characters."
  };

  function validateField(field) {
    var errorEl = document.getElementById(field.id + "-error");
    var value = field.value.trim();
    var valid = field.checkValidity() && (field.required ? value.length > 0 : true);

    if (field.id === "phone" && value && !/^[+()\d\s-]{7,25}$/.test(value)) valid = false;
    if (field.minLength > 0 && field.required && value.length < field.minLength) valid = false;

    field.setAttribute("aria-invalid", String(!valid));
    if (errorEl) errorEl.textContent = valid ? "" : messages[field.id];
    return valid;
  }

  var fields = ["name", "email", "phone", "subject", "message"].map(function (id) {
    return document.getElementById(id);
  });

  fields.forEach(function (field) {
    field.addEventListener("blur", function () { if (field.value || field.required) validateField(field); });
    field.addEventListener("input", function () {
      if (field.getAttribute("aria-invalid") === "true") validateField(field);
    });
  });

  function showStatus(type, text) {
    statusEl.className = "form-status is-" + type;
    statusEl.textContent = text;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.className = "form-status";
    statusEl.textContent = "";

    var allValid = fields.map(validateField).every(Boolean);
    if (!allValid) {
      var firstBad = fields.find(function (f) { return f.getAttribute("aria-invalid") === "true"; });
      if (firstBad) firstBad.focus();
      showStatus("error", "Please correct the highlighted fields and try again.");
      return;
    }

    var payload = {
      name: form.elements["name"].value.trim(),
      email: form.elements["email"].value.trim(),
      phone: form.elements["phone"].value.trim(),
      subject: form.elements["subject"].value.trim(),
      message: form.elements["message"].value.trim(),
      company: form.elements["company"].value,                // honeypot
      elapsedMs: Date.now() - pageLoadedAt         // very fast submits are bots
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok && data.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          form.reset();
          fields.forEach(function (f) { f.removeAttribute("aria-invalid"); });
          showStatus("success", "Thank you. Your message has been sent. We will reply as soon as we can.");
        } else {
          showStatus("error", (result.data && result.data.error) ||
            "Your message could not be sent. Please try again, or email info@mountsalemzion.org.");
        }
      })
      .catch(function () {
        showStatus("error", "We could not reach the server. Check your connection and try again, or email info@mountsalemzion.org.");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send message";
      });
  });
})();
