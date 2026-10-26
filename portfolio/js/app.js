/* =========================================================
   AHMED RAZA KHAN — portfolio behaviour
   Vanilla JS, no dependencies.
   ========================================================= */
(function () {
  "use strict";

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------
     1. THEME (light / dark, persisted)
  ------------------------------------------------------ */
  const root = document.documentElement;
  const themeBtn = $("#themeToggle");
  const storedTheme = localStorage.getItem("ark-theme");
  const initialTheme =
    storedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(initialTheme);

  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    if (themeBtn) themeBtn.textContent = t === "dark" ? "◑" : "◐";
  }
  themeBtn && themeBtn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("ark-theme", next);
  });

  /* ------------------------------------------------------
     2. MOBILE NAV
  ------------------------------------------------------ */
  const navLinks = $("#navLinks");
  const burger = $("#navToggle");
  burger && burger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
    burger.textContent = open ? "✕" : "≡";
  });
  $$(".nav-link").forEach((a) =>
    a.addEventListener("click", () => {
      navLinks.classList.remove("open");
      burger && (burger.textContent = "≡", burger.setAttribute("aria-expanded", "false"));
    })
  );

  /* ------------------------------------------------------
     3. SCROLLSPY — highlight active section in nav
  ------------------------------------------------------ */
  const sections = $$("main section[id]");
  const linkMap = new Map($$(".nav-link").map((a) => [a.getAttribute("href").slice(1), a]));
  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const l = linkMap.get(e.target.id);
          if (!l) return;
          if (e.isIntersecting) {
            $$(".nav-link").forEach((x) => x.classList.remove("is-active"));
            l.classList.add("is-active");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ------------------------------------------------------
     4. REVEAL ON SCROLL + animated counters + skill bars
  ------------------------------------------------------ */
  const revealEls = $$(".reveal");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("in"));
    $$("[data-count]").forEach((el) => (el.textContent = el.dataset.count));
  } else {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          $$("[data-count]", entry.target).forEach(countUp);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.18 }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  function countUp(el) {
    const target = parseInt(el.dataset.count, 10);
    const dur = 1200;
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ------------------------------------------------------
     5. SKILL CHIPS → filter projects by tag
  ------------------------------------------------------ */
  const chipCloud = $("#chipCloud");
  const cards = $$(".project-card");
  const emptyState = $("#emptyState");
  const allTags = [...new Set(cards.flatMap((c) => (c.dataset.tags || "").split(",").map(t => t.trim())))].sort();

  if (chipCloud) {
    chipCloud.innerHTML = allTags
      .map((t) => `<button class="chip-btn" type="button" data-tag="${t}">${t}</button>`)
      .join("");
  }

  let activeTag = null;
  let activeCat = "all";

  function applyFilter() {
    let visible = 0;
    cards.forEach((card) => {
      const catOk = activeCat === "all" || (card.dataset.cat || "").includes(activeCat);
      const tagOk = !activeTag || (card.dataset.tags || "").split(",").map(s=>s.trim()).includes(activeTag);
      const show = catOk && tagOk;
      card.classList.toggle("hide", !show);
      if (show) visible++;
    });
    if (emptyState) emptyState.hidden = visible !== 0;
  }

  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip-btn");
    if (chip) {
      activeTag = activeTag === chip.dataset.tag ? null : chip.dataset.tag;
      $$(".chip-btn").forEach((c) => c.classList.toggle("is-active", c.dataset.tag === activeTag));
      applyFilter();
      document.getElementById("projects").scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
      return;
    }
    const f = e.target.closest(".filter");
    if (f) {
      activeCat = f.dataset.filter;
      $$(".filter").forEach((x) => x.classList.toggle("is-active", x === f));
      applyFilter();
    }
  });

  /* ------------------------------------------------------
     6. PROJECT MODAL (case studies)
  ------------------------------------------------------ */
  const CASES = {
    p1: {
      title: "132/13 kV Grid Station Protection Coordination",
      kicker: "P-01 · NIPES · 2024 · POWER SYSTEMS",
      body: `<p>Complete protection study for an existing double-busbar grid station feeding an
             industrial zone. The objective: eliminate nuisance trips and bring every fault inside
             the utility's 300&nbsp;ms clearing envelope.</p>
             <ul><li>Modelled the network in ETAP with 2023–2034 load growth scenarios.</li>
             <li>Computed max/min short-circuit duties; verified breaker interrupting margins.</li>
             <li>Plotted TMS/PSM curves on log-current/time axes and resolved 9 relay conflicts.</li></ul>
             <dl class="specs">
               <div><dt>RELAYS SET</dt><dd>44 numerical</dd></div>
               <div><dt>CLEARING Δ</dt><dd>−38%</dd></div>
               <div><dt>FAULT LEVEL</dt><dd>25 kA / 3 s</dd></div>
               <div><dt>STANDARD</dt><dd>IEC 60255</dd></div>
             </dl>`
    },
    p2: {
      title: "Three-Phase Energy Monitor (STM32G4)",
      kicker: "P-02 · SIDE PROJECT · 2024 · EMBEDDED / PCB",
      body: `<p>A DIN-rail mounted metering node for factory sub-panels. Measures V, I, P, PF and
             harmonics up to the 25th order on three phases, publishing over RS-485 Modbus-RTU.</p>
             <ul><li>4-layer KiCad board: split analog/digital ground planes, guarded differential inputs.</li>
             <li>Sigma-delta sampling at 16&nbsp;kHz with DMA into a fixed-point RMS/DFT pipeline.</li>
             <li>Firmware in Embedded C (HAL + free RTOS); OTA bootloader over Modbus.</li></ul>
             <dl class="specs">
               <div><dt>ACCURACY</dt><dd>0.5% (class B)</dd></div>
               <div><dt>MCU</dt><dd>STM32G431</dd></div>
               <div><dt>LAYERS</dt><dd>4 · 78 × 92 mm</dd></div>
               <div><dt>EMC</dt><dd>Pass, spin 2</dd></div>
             </dl>`
    },
    p3: {
      title: "250 kW Rooftop Solar Feasibility — NUST Block H",
      kicker: "P-03 · CONSULT · 2023 · RENEWABLES",
      body: `<p>Techno-economic feasibility for net-metering a 250&nbsp;kW array across four academic
             blocks, including shading, structural and single-line design.</p>
             <ul><li>PVsyst yield simulation validated against one year of billing data.</li>
             <li>Simulink MPPT model (P&O + variable step) to compare string inverters.</li>
             <li>Delivered ROI analysis: 4.8-year payback under NEP 2022 net-metering.</li></ul>
             <dl class="specs">
               <div><dt>ARRAY</dt><dd>250 kWp · 585 modules</dd></div>
               <div><dt>YIELD</dt><dd>1,540 kWh/kWp</dd></div>
               <div><dt>PAYBACK</dt><dd>4.8 years</dd></div>
               <div><dt>CO₂ SAVED</dt><dd>≈178 t/yr</dd></div>
             </dl>`
    },
    p4: {
      title: "3.3 kW Totem-Pole GaN PFC + LLC Converter",
      kicker: "P-04 · METRO ELECTRONICS · 2023 · POWER ELECTRONICS",
      body: `<p>Two-stage front end for a telecom rectifier shelf: continuous-conduction totem-pole
             PFC followed by a half-bridge LLC resonant stage at 400&nbsp;V DC bus.</p>
             <ul><li>Gate-loop inductance kept under 5&nbsp;nH via Kelvin-source layout.</li>
             <li>Magnetics designed in LTSpice + Excel thermal model; forced-air heatsink at 55&nbsp;°C ambient.</li>
             <li>Digital control loop on C2000 MCU with feed-forward duty compensation.</li></ul>
             <dl class="specs">
               <div><dt>PEAK EFF.</dt><dd>96.4%</dd></div>
               <div><dt>SWITCHING</dt><dd>65 kHz PFC / 180 kHz LLC</dd></div>
               <div><dt>PF</dt><dd>&gt;0.99 @ 50% load</dd></div>
               <div><dt>BURN-IN</dt><dd>200 h full load</dd></div>
             </dl>`
    },
    p5: {
      title: "Water Pump Station SCADA Retrofit",
      kicker: "P-05 · NIPES · 2022 · INDUSTRIAL AUTOMATION",
      body: `<p>Retrofitted six legacy DOL-start bore pumps with soft-controlled VFDs behind a central
             SCADA, without interrupting daily irrigation supply.</p>
             <ul><li>S7-1200 PLC ladder + function-block control, Ignition HMI at the tube-well office.</li>
             <li>Dry-run detection using power-factor signature instead of flow meters (budget win).</li>
             <li>Sequencer staggers starts so inrush never exceeds the 400&nbsp;kVA transformer rating.</li></ul>
             <dl class="specs">
               <div><dt>PUMPS</dt><dd>6 × 37 kW</dd></div>
               <div><dt>PROTOCOL</dt><dd>DNP3 over GPRS</dd></div>
               <div><dt>DRY-RUNS</dt><dd>0 in year 1</dd></div>
               <div><dt>SAVING</dt><dd>19% energy</dd></div>
             </dl>`
    },
    p6: {
      title: "Single-Phase Grid-Tied Inverter Capstone",
      kicker: "P-06 · NUST THESIS · 2022 · POWER ELECTRONICS",
      body: `<p>Final-year design of a 1&nbsp;kW full-bridge grid-tied inverter with current-controlled
             injection synchronised through a software PLL.</p>
             <ul><li>TMS320F28069 C2000 DSP; PR current controller tuned for 50&nbsp;Hz with 3rd/5th harmonics compensation.</li>
             <li>Active + passive anti-islanding per IEEE 1547.1 (RoCoF &amp; impedance jump).</li>
             <li>Measured THD 2.4%, efficiency 94.1% at half load — report graded A+.</li></ul>
             <dl class="specs">
               <div><dt>RATING</dt><dd>1 kW / 230 V / 50 Hz</dd></div>
               <div><dt>THD</dt><dd>2.4%</dd></div>
               <div><dt>ISlanding</dt><dd>&lt; 2 s trip</dd></div>
               <div><dt>GRADE</dt><dd>A+ · Dean's list</dd></div>
             </dl>`
    }
  };

  const modal = $("#projectModal");
  const panel = $(".modal-panel", modal);
  let lastFocus = null;

  function openModal(id) {
    const c = CASES[id];
    if (!c || !modal) return;
    $("#modalKicker").textContent = c.kicker;
    $("#modalTitle").textContent = c.title;
    $("#modalBody").innerHTML = c.body;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    panel.focus();
  }
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    lastFocus && lastFocus.focus();
  }
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-project]");
    if (trigger) { e.preventDefault(); openModal(trigger.dataset.project); return; }
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab" && modal && !modal.hidden) {          // simple focus trap
      const f = $$('a[href], button, [tabindex]:not([tabindex="-1"])', panel);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ------------------------------------------------------
     7. CONTACT FORM — client-side validation + mailto handoff
  ------------------------------------------------------ */
  const form = $("#contactForm");
  const note = $("#formNote");
  const rules = {
    name:    (v) => v.trim().length >= 2 || "Please enter your name (min 2 characters).",
    email:   (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Enter a valid email address.",
    message: (v) => v.trim().length >= 12 || "Message should be at least 12 characters."
  };

  function validateField(input) {
    const rule = rules[input.name];
    if (!rule) return true;
    const result = rule(input.value);
    const field = input.closest(".field");
    const err = $(`.err[data-for="${input.name}"]`);
    const ok = result === true;
    field.classList.toggle("invalid", !ok);
    if (err) err.textContent = ok ? "" : result;
    input.setAttribute("aria-invalid", String(!ok));
    return ok;
  }

  if (form) {
    ["name", "email", "message"].forEach((n) => {
      const el = form.elements[n];
      el.addEventListener("blur", () => validateField(el));
      el.addEventListener("input", () => {
        if (el.closest(".field").classList.contains("invalid")) validateField(el);
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fields = ["name", "email", "message"].map((n) => form.elements[n]);
      const allOk = fields.map(validateField).every(Boolean);
      if (!allOk) {
        note.textContent = "CHECK THE HIGHLIGHTED FIELDS.";
        note.className = "form-note mono bad";
        fields.find((f) => f.closest(".field").classList.contains("invalid")).focus();
        return;
      }
      const { name, email, topic, message } = Object.fromEntries(new FormData(form));
      const subject = encodeURIComponent(`[${topic}] Portfolio enquiry from ${name}`);
      const body = encodeURIComponent(`${message}\n\n— ${name}\n${email}`);
      window.location.href = `mailto:ahmed.raza.khan@example.com?subject=${subject}&body=${body}`;
      note.textContent = "THANKS! YOUR MAIL CLIENT SHOULD HAVE OPENED. I REPLY WITHIN 24 H.";
      note.className = "form-note mono ok";
      form.reset();
    });
  }

  /* ------------------------------------------------------
     8. RESUME — generates a printable one-page CV
  ------------------------------------------------------ */
  const resumeBtn = $("#resumeBtn");
  resumeBtn && resumeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const w = window.open("", "_blank", "width=880,height=1000");
    if (!w) { alert("Please allow pop-ups to download the résumé."); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>Ahmed Raza Khan — Résumé</title>
      <meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=IBM+Plex+Mono&display=swap" rel="stylesheet">
      <style>
        body{font-family:'Space Grotesk',sans-serif;margin:38px;color:#0a0a0a;line-height:1.5}
        h1{font-size:30px;margin:0;letter-spacing:1px}
        h2{font-size:12px;font-family:'IBM Plex Mono',monospace;letter-spacing:2px;border-bottom:3px solid #0a0a0a;padding-bottom:4px;margin:22px 0 10px;text-transform:uppercase}
        .sub{font-family:'IBM Plex Mono',monospace;font-size:12px;margin:4px 0 0}
        .row{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}
        .row b{font-size:14px}.row span{font-family:'IBM Plex Mono',monospace;font-size:11px;white-space:nowrap}
        ul{margin:4px 0 0;padding-left:18px;font-size:13px}
        li{margin-bottom:3px}
        .chips{font-size:12px;font-family:'IBM Plex Mono',monospace}
        button{position:fixed;top:12px;right:12px;font-family:'IBM Plex Mono',monospace;border:3px solid #0a0a0a;background:#ff5c00;padding:8px 14px;cursor:pointer;font-weight:700}
        @media print{button{display:none}body{margin:18mm}}
      </style></head><body>
      <button onclick="window.print()">PRINT / SAVE PDF</button>
      <h1>AHMED RAZA KHAN</h1>
      <p class="sub">Electrical &amp; Power Systems Engineer · Islamabad, Pakistan<br>
      ahmed.raza.khan@example.com · +92 300 123 4567 · linkedin.com/in/ahmedrazakhan</p>
      <h2>Summary</h2>
      <p style="font-size:13px;margin:0">NUST (SEEMS) BS Electrical Engineering, 5 years across transmission
      consulting, power products and embedded hardware. PEC registered.</p>
      <h2>Experience</h2>
      <div class="row"><div><b>Electrical Engineer — T&amp;D</b><br>National Power Consulting Engineering Services (NIPES)</div><span>2023–Present</span></div>
      <ul><li>Design review of 47 nos. 132/11 kV substation expansions; relay commissioning owner's engineer.</li></ul>
      <div class="row"><div><b>Junior Electronics Engineer</b><br>Metro Electronics (Pvt.) Ltd.</div><span>2022–2023</span></div>
      <ul><li>UPS inverter boards prototype→production; automated test-characterisation reporting.</li></ul>
      <div class="row"><div><b>Intern — HV Lab</b><br>SEEMS, NUST</div><span>Summer 2021</span></div>
      <h2>Education</h2>
      <div class="row"><div><b>BS Electrical Engineering</b> — SEEMS, NUST Islamabad · CGPA 3.71/4.00</div><span>2018–2022</span></div>
      <div class="row"><div><b>FSc Pre-Engineering</b> — FG Public College · 94.2%</div><span>2016–2018</span></div>
      <h2>Skills</h2>
      <p class="chips">ETAP · Load flow &amp; short circuit · Protection coordination (IEC 60255) · MATLAB/Simulink ·
      LTSpice · KiCad · Altium · Embedded C (STM32, AVR, C2000) · Python · PLC TIA Portal · SCADA/Modbus/DNP3 ·
      Power electronics (PFC, LLC, inverters) · AutoCAD Electrical</p>
      <h2>Certifications</h2>
      <p class="chips">PEC Registered Engineer (BM-14xxxx) · ETAP Certified Professional User · Siemens TIA Portal L1/L2</p>
      </body></html>`);
    w.document.close();
  });

  /* ------------------------------------------------------
     9. LIVE PKT CLOCK + footer year
  ------------------------------------------------------ */
  const clock = $("#clock");
  function tickClock() {
    if (!clock) return;
    try {
      clock.textContent = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
      }).format(new Date());
    } catch (_) {
      clock.textContent = new Date().toLocaleTimeString();
    }
  }
  tickClock();
  setInterval(tickClock, 1000);

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ------------------------------------------------------
     10. FLOATING SCROLL-TO-TOP BUTTON
  ------------------------------------------------------ */
  const scrollTopBtn = $("#scrollTop");
  const onScroll = () => scrollTopBtn && scrollTopBtn.classList.toggle("show", window.scrollY > 700);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  scrollTopBtn && scrollTopBtn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" })
  );
})();
