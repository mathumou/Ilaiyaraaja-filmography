/* =====================================================================
   Ilaiyaraaja Filmography — client app
   Loads films.json, filters/sorts in-memory, renders cards incrementally.
   ===================================================================== */

(() => {
  "use strict";

  const BATCH = 60;

  const els = {
    grid:     document.getElementById("grid"),
    sentinel: document.getElementById("sentinel"),
    q:        document.getElementById("q"),
    decade:   document.getElementById("decade"),
    year:     document.getElementById("year"),
    lang:     document.getElementById("lang"),
    sort:     document.getElementById("sort"),
    count:    document.getElementById("count"),
    statTotal: document.getElementById("stat-total"),
    statYears: document.getElementById("stat-years"),
    statLangs: document.getElementById("stat-langs"),
    statTamil: document.getElementById("stat-tamil"),
    statPeak:  document.getElementById("stat-peak"),
    generated: document.getElementById("generated"),
  };

  let films = [];        // master list
  let filtered = [];     // current filter result
  let cursor = 0;        // next index to render in `filtered`

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      // Cache-bust on every load so stale films.json never blocks new poster URLs
      const data = await fetchJSON("assets/data/films.json?v=" + Date.now());
      films = data.films.map(prepare);

      populateStats(data);
      populateFilters();
      bindControls();
      bindCardClicks();
      applyFilter();

      observeSentinel();
    } catch (err) {
      els.grid.innerHTML = `<p class="empty">Could not load films data. (${escapeHtml(err.message)})</p>`;
      els.count.textContent = "—";
    }
  }

  async function fetchJSON(url) {
    const r = await fetch(url, { cache: "default" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  /** Cache a lowercased search blob on each film */
  function prepare(f) {
    const haystack = [
      f.en || "",
      f.ta || "",
      ...(f.alt || []),
      f.l || "",
      f.y || ""
    ].join(" ").toLowerCase();
    f._search = haystack;
    return f;
  }

  // ------------------------------------------------------------------
  // Stats + filter populate
  // ------------------------------------------------------------------
  function populateStats(data) {
    const years = films.map(f => f.y).filter(Boolean);
    const langs = new Set();
    films.forEach(f => {
      if (!f.l) return;
      // Split multi-lang like "Tamil / Telugu"
      f.l.split(/[\/,]/).forEach(p => {
        const t = p.trim();
        if (t) langs.add(t);
      });
    });
    const withTamil = films.filter(f => f.ta).length;

    // Decade counts
    const decadeCounts = {};
    years.forEach(y => {
      const d = Math.floor(y / 10) * 10;
      decadeCounts[d] = (decadeCounts[d] || 0) + 1;
    });
    let peakDecade = 1980, peakCount = 0;
    for (const [d, c] of Object.entries(decadeCounts)) {
      if (c > peakCount) { peakCount = c; peakDecade = +d; }
    }

    els.statTotal.textContent = data.count.toLocaleString();
    els.statYears.textContent = years.length
      ? `${Math.min(...years)}–${Math.max(...years)}`
      : "—";
    els.statLangs.textContent = langs.size;
    els.statTamil.textContent = withTamil.toLocaleString();
    els.statPeak.textContent = peakCount.toLocaleString();

    if (data.generated) {
      els.generated.textContent = "Data generated " + data.generated;
    }
  }

  function populateFilters() {
    // Decades
    const decadeSet = new Set();
    const yearSet = new Set();
    const langSet = new Set();

    films.forEach(f => {
      if (f.y) {
        decadeSet.add(Math.floor(f.y / 10) * 10);
        yearSet.add(f.y);
      }
      if (f.l) langSet.add(f.l);
    });

    const decades = [...decadeSet].sort();
    decades.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d + "s";
      els.decade.appendChild(opt);
    });

    const years = [...yearSet].sort((a, b) => b - a);
    years.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      els.year.appendChild(opt);
    });

    const langs = [...langSet].sort();
    langs.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l;
      opt.textContent = l;
      els.lang.appendChild(opt);
    });
  }

  // ------------------------------------------------------------------
  // Event binding
  // ------------------------------------------------------------------
  let searchRaf = null;
  function bindControls() {
    els.q.addEventListener("input", () => {
      if (searchRaf) cancelAnimationFrame(searchRaf);
      searchRaf = requestAnimationFrame(() => {
        searchRaf = null;
        applyFilter();
      });
    });

    [els.decade, els.year, els.lang, els.sort].forEach(el => {
      el.addEventListener("change", () => {
        // If decade chosen, narrow the year list visually but keep it simple
        applyFilter();
      });
    });

    // Reset year when decade changes if year is outside
    els.decade.addEventListener("change", () => {
      const d = +els.decade.value;
      if (!d) return;
      const cur = +els.year.value;
      if (cur && (cur < d || cur > d + 9)) {
        els.year.value = "";
      }
    });
  }

  // ------------------------------------------------------------------
  // Filter / sort / render
  // ------------------------------------------------------------------
  function applyFilter() {
    closeModal();   // re-renders the grid; any open modal would be stale
    const q       = els.q.value.trim().toLowerCase();
    const decade  = els.decade.value ? +els.decade.value : null;
    const year    = els.year.value ? +els.year.value : null;
    const lang    = els.lang.value || null;
    const sortBy  = els.sort.value;

    filtered = films.filter(f => {
      if (q && !f._search.includes(q)) return false;
      if (year && f.y !== year) return false;
      if (decade && (!f.y || f.y < decade || f.y > decade + 9)) return false;
      if (lang && f.l !== lang) return false;
      return true;
    });

    sortFiltered(sortBy);

    // Reset render
    cursor = 0;
    els.grid.replaceChildren();
    renderBatch();

    // Update count
    const total = films.length;
    if (filtered.length === total) {
      els.count.innerHTML = `<strong>${total.toLocaleString()}</strong> films`;
    } else {
      els.count.innerHTML = `<strong>${filtered.length.toLocaleString()}</strong> of ${total.toLocaleString()} films`;
    }

    els.grid.setAttribute("aria-busy", "false");
  }

  function sortFiltered(mode) {
    const cmpStr = (a, b) => (a || "").localeCompare(b || "", undefined, { sensitivity: "base" });
    switch (mode) {
      case "year-asc":
        filtered.sort((a, b) => (a.y || 9999) - (b.y || 9999) || cmpStr(a.en, b.en));
        break;
      case "year-desc":
        filtered.sort((a, b) => (b.y || 0) - (a.y || 0) || cmpStr(a.en, b.en));
        break;
      case "name-asc":
        filtered.sort((a, b) => cmpStr(a.en || a.ta, b.en || b.ta));
        break;
      case "name-desc":
        filtered.sort((a, b) => cmpStr(b.en || b.ta, a.en || a.ta));
        break;
    }
  }

  function renderBatch() {
    if (cursor >= filtered.length) {
      if (filtered.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "No films match your search.";
        els.grid.appendChild(empty);
      }
      return;
    }
    const end = Math.min(cursor + BATCH, filtered.length);
    const frag = document.createDocumentFragment();
    for (let i = cursor; i < end; i++) {
      frag.appendChild(renderCard(filtered[i]));
    }
    els.grid.appendChild(frag);
    cursor = end;
  }

  function renderCard(f) {
    const card = document.createElement("article");
    card.className = "card" + (f.img ? " has-poster" : " no-poster");
    card.setAttribute("role", "listitem");
    card.tabIndex = 0;
    card._film = f;

    // Poster area
    const poster = document.createElement("div");
    poster.className = "poster";
    if (f.img) {
      const img = document.createElement("img");
      img.src = f.img;
      img.alt = (f.en || f.ta || "Film") + " poster";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        // If image fails, replace with placeholder
        poster.classList.add("poster-fail");
        img.remove();
        addPlaceholder(poster, f);
      };
      poster.appendChild(img);
    } else {
      addPlaceholder(poster, f);
    }
    card.appendChild(poster);

    // Card body
    const body = document.createElement("div");
    body.className = "card-body";

    // Year badge (top-right of card, over poster)
    const badge = document.createElement("span");
    badge.className = "year-badge" + (f.y ? "" : " no-year");
    badge.textContent = f.y || "—";
    card.appendChild(badge);

    // Tamil title (if any)
    if (f.ta) {
      const t = document.createElement("h2");
      t.className = "title-ta-card";
      t.lang = "ta";
      t.textContent = f.ta;
      body.appendChild(t);
    }

    // English title
    if (f.en) {
      const e = document.createElement("p");
      e.className = "title-en-card" + (f.ta ? "" : " standalone");
      e.textContent = f.en;
      body.appendChild(e);
    }

    // Alt names
    if (f.alt && f.alt.length) {
      const alt = document.createElement("p");
      alt.className = "alt";
      alt.textContent = f.alt.join(", ");
      body.appendChild(alt);
    }

    // Chips: language
    if (f.l) {
      const chips = document.createElement("div");
      chips.className = "chips";
      const chip = document.createElement("span");
      const isMulti = /[\/,]/.test(f.l);
      chip.className = "chip" + (isMulti ? " multi-lang" : "");
      chip.textContent = f.l;
      chips.appendChild(chip);
      body.appendChild(chips);
    }

    card.appendChild(body);
    return card;
  }

  function addPlaceholder(poster, f) {
    poster.classList.add("placeholder");
    const initial = (f.en || f.ta || "♫").trim().charAt(0).toUpperCase();
    const letter = document.createElement("span");
    letter.className = "placeholder-letter";
    letter.textContent = initial;
    letter.setAttribute("aria-hidden", "true");
    poster.appendChild(letter);
    // Decorative film-strip note
    const note = document.createElement("span");
    note.className = "placeholder-note";
    note.textContent = "♪";
    note.setAttribute("aria-hidden", "true");
    poster.appendChild(note);
  }

  // ------------------------------------------------------------------
  // Modal: tap-to-expand card
  // ------------------------------------------------------------------
  let modalEl = null;

  function bindCardClicks() {
    // Delegated click handler on the grid; cards attach via `_film`
    els.grid.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (!card || !els.grid.contains(card)) return;
      const film = card._film;
      if (film) openModal(film);
    });
    // Keyboard: Enter / Space on a focused card opens the modal too.
    els.grid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".card");
      if (!card || !els.grid.contains(card)) return;
      e.preventDefault();
      const film = card._film;
      if (film) openModal(film);
    });
  }

  function openModal(film) {
    closeModal();
    const root = document.getElementById("modal-root") || document.body;
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");

    const big = renderCard(film);
    big.classList.add("modal-card");
    big.removeAttribute("tabindex");
    big.setAttribute("role", "document");
    backdrop.appendChild(big);

    // Single bubbled click closes — works for tap on backdrop OR on card.
    backdrop.addEventListener("click", closeModal);

    root.appendChild(backdrop);
    document.body.classList.add("modal-open");
    modalEl = backdrop;
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.remove();
    modalEl = null;
    document.body.classList.remove("modal-open");
  }

  // ------------------------------------------------------------------
  // Incremental rendering on scroll
  // ------------------------------------------------------------------
  function observeSentinel() {
    if (!("IntersectionObserver" in window)) {
      // Fallback: render everything (rare)
      while (cursor < filtered.length) renderBatch();
      return;
    }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) renderBatch();
      }
    }, { rootMargin: "600px 0px" });
    io.observe(els.sentinel);
  }

  // ------------------------------------------------------------------
  // Utility
  // ------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
})();
