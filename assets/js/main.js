// ============================================
// Cornell SPS Website - Main JavaScript
// Minimalistic, fast, no frameworks
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initEboard();
  initLogoScroll();
  initEvents();
});

// --- Navbar: hamburger toggle + auto-hide on scroll ---
function initNavbar() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const navbar = document.getElementById('navbar');

  if (!hamburger || !sidebar || !overlay) return;

  function toggleSidebar() {
    hamburger.classList.toggle('active');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    var homeLocked = !!document.getElementById('hero-interactive');
    document.body.style.overflow = (sidebar.classList.contains('active') || homeLocked) ? 'hidden' : '';
  }

  hamburger.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', toggleSidebar);

  // Close sidebar on link click
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      if (sidebar.classList.contains('active')) {
        toggleSidebar();
      }
    });
  });

  // Auto-hide navbar on scroll down, show on scroll up
  let lastScrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    if (sidebar.classList.contains('active')) return;
    if (window.scrollY > lastScrollY && window.scrollY > 80) {
      navbar.classList.add('hidden');
    } else {
      navbar.classList.remove('hidden');
    }
    lastScrollY = window.scrollY;
  }, { passive: true });
}

// --- E-Board: CSV-powered people grid with tabs ---
// Images are always resolved from /assets/images/people/
const PEOPLE_IMAGE_BASE = '/assets/images/people/';

function initEboard() {
  const container = document.getElementById('eboard-grid');
  const tabContainer = document.getElementById('eboard-tabs');
  if (!container || !tabContainer) return;

  const csvPaths = {
    admin: container.dataset.csvAdmin,
    alumni: container.dataset.csvAlumni
  };
  if (!csvPaths.admin && !csvPaths.member) return;

  const peopleByTab = {};

  // Load both CSVs in parallel
  Promise.all(
    Object.entries(csvPaths).map(([tab, path]) =>
      path
        ? fetch(path).then(res => res.text()).then(csv => { peopleByTab[tab] = parseCSV(csv); })
        : Promise.resolve()
    )
  ).then(() => {
    // Show admin (E-Board) tab by default
    renderPeople(peopleByTab['admin'] || []);

    // Set up tab clicks
    tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderPeople(peopleByTab[btn.dataset.tab] || []);
      });
    });
  }).catch(err => {
    console.error('Failed to load E-Board data:', err);
    container.innerHTML = '<p style="text-align:center;color:#6b7280;">Failed to load E-Board data.</p>';
  });

  function renderPeople(people) {
    if (!people.length) {
      container.innerHTML = '<p style="text-align:center;color:#6b7280;">No people to show in this category yet.</p>';
      return;
    }
    container.innerHTML = people.map(person => {
      const imgSrc = person.image
        ? `${PEOPLE_IMAGE_BASE}${person.image}`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&size=220&background=e5e7eb&color=1a3a5c&bold=true`;
      const link = person.linkedin
        ? `https://www.linkedin.com/in/${person.linkedin}`
        : '#';
      return `
        <div class="person-card">
          <a href="${link}" target="_blank" rel="noopener">
            <img class="person-image" src="${imgSrc}" alt="${person.name}" loading="lazy"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&size=220&background=e5e7eb&color=1a3a5c&bold=true'">
            <div class="person-info">
              <div class="person-name">${person.name}</div>
              <div class="person-role">${person.title || ''}</div>
            </div>
          </a>
        </div>
      `;
    }).join('');
  }
}

// --- Interactive Logo: scroll-driven rotation with momentum ---
//
// Geometry
// --------
// The origin of rotation O is the centre of the largest ring.
// It never moves.  A "spine" line extends from O at angle θ
// (radians, CCW from +x in math coords; SVG y-down so sin flips).
//
// Each ring i has fixed radius R[i].  Its centre sits on the spine
// at distance (R₀ − Rᵢ) from O:
//
//     C_i  =  O  +  (R₀ − R_i) · (cos θ,  −sin θ)
//
// The moving touch-point where every ring intersects is:
//
//     P    =  O  +  R₀ · (cos θ,  −sin θ)
//
// Because |C_i − P| = R_i, every ring passes through P and they
// share the same tangent there — they "touch at the end."
// The largest ring (R₀) stays anchored at O; smaller rings orbit
// farther out.
//
// The SPS text is placed at the centre of the innermost ring.
// Since we position it by (x, y) rather than a rotation transform,
// it stays upright automatically.
//
// Scroll / touch adds angular impulse → angular velocity ω decays
// via friction → θ evolves smoothly.
// ----------------------------------------------------------------

function initLogoScroll() {
  const logo = document.getElementById('sps-logo');
  const hero = document.getElementById('hero-interactive');
  if (!logo || !hero) return;

  // Lock page scroll on the home page
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  const rings = logo.querySelectorAll('.logo-ring');
  const spsText = document.getElementById('sps-text');
  const scrollHint = document.getElementById('scroll-hint');

  // --- Fixed geometry ---
  const OX = 250, OY = 250;           // pivot = centre of the largest ring (centred in viewBox)
  const R = [215, 170, 127, 85]; // ring radii, largest → smallest
  const TEXT_RING = 3;                 // text lives at the centre of ring 3

  // Offset multiplier: 0 = perfectly concentric, 1 = all rings share a single
  // tangent point.  0.25 keeps visible, even-ish spacing between rings while
  // still producing a nice wobble effect on rotation.
  const OFFSET_K = 0.5;

  // --- Animation state ---
  let theta = 0;                       // spine angle (radians), starts at 0 (horizontal right)
  let omega = 0;                       // angular velocity (rad / frame)
  const FRICTION = 0.96;

  // --- Sensitivity: input → angular impulse ---
  const WHEEL_K = 0.0005;             // rad per pixel of wheel deltaY
  const TOUCH_K = 0.0010;             // rad per pixel of touch drag

  let animating = false;
  let interacted = false;

  // --- Render one frame ---
  function render() {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    for (let i = 0; i < rings.length; i++) {
      const d = OFFSET_K * (R[0] - R[i]); // scaled offset – keeps visible gaps between rings
      rings[i].setAttribute('cx', OX + d * c);
      rings[i].setAttribute('cy', OY - d * s);
      rings[i].setAttribute('r', R[i]);
    }
    // Text at innermost ring centre — no rotation transform, stays upright
    const dText = OFFSET_K * (R[0] - R[TEXT_RING]);
    spsText.setAttribute('x', OX + dText * c);
    spsText.setAttribute('y', OY - dText * s);
  }

  // --- Animation loop ---
  function tick() {
    if (!animating) return;
    theta += omega;
    omega *= FRICTION;
    render();
    if (Math.abs(omega) < 1e-4) {
      omega = 0;
      animating = false;
      return;
    }
    requestAnimationFrame(tick);
  }

  function nudge(dOmega) {
    omega += dOmega;
    if (!interacted) {
      interacted = true;
      if (scrollHint) scrollHint.style.opacity = '0';
    }
    if (!animating) {
      animating = true;
      requestAnimationFrame(tick);
    }
  }

  // --- Input handlers ---
  window.addEventListener('wheel', function (e) {
    e.preventDefault();
    nudge(e.deltaY * WHEEL_K);
  }, { passive: false });

  let lastTouchY = 0;
  window.addEventListener('touchstart', function (e) {
    lastTouchY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    e.preventDefault();
    const dy = lastTouchY - e.touches[0].clientY;
    lastTouchY = e.touches[0].clientY;
    nudge(dy * TOUCH_K);
  }, { passive: false });

  // --- Kickoff: render at θ = 0 (horizontal right), no initial spin ---
  render();
}

// --- Events: CSV-powered event cards with tabs ---
// Status (upcoming vs past) is determined automatically from the timeline date.
function initEvents() {
  const cardsContainer = document.getElementById('event-cards');
  const tabContainer = document.getElementById('event-tabs');
  const emptyMsg = document.getElementById('event-empty');
  if (!cardsContainer || !tabContainer) return;

  const csvPath = cardsContainer.dataset.csv;
  if (!csvPath) return;

  fetch(csvPath)
    .then(res => res.text())
    .then(csv => {
      const events = parseCSV(csv);
      setupEventTabs(events);
    })
    .catch(err => {
      console.error('Failed to load events:', err);
      cardsContainer.innerHTML = '<p style="text-align:center;color:#6b7280;">Failed to load events.</p>';
    });

  // Classify an event as "upcoming" or "past" based on its timeline date.
  // Dates that can't be parsed default to "past".
  function eventStatus(event) {
    const d = new Date(event.timeline);
    if (isNaN(d)) return 'past';
    // Compare using end-of-day so events on today's date still count as upcoming
    d.setHours(23, 59, 59, 999);
    return d >= new Date() ? 'upcoming' : 'past';
  }

  function renderEvents(events, status) {
    const filtered = events.filter(e => eventStatus(e) === status);
    if (!filtered.length) {
      cardsContainer.innerHTML = '';
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';

    // Sort: upcoming → soonest first; past → most recent first
    if (status === 'upcoming') {
      filtered.sort((a, b) => new Date(a.timeline) - new Date(b.timeline));
    } else {
      filtered.sort((a, b) => new Date(b.timeline) - new Date(a.timeline));
    }

    cardsContainer.innerHTML = filtered.map(event => {
      const imageHtml = event.image
        ? `<div class="event-card-image"><img src="${event.image}" alt="${event.title}" loading="lazy"></div>`
        : `<div class="event-card-image event-card-image--placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>`;

      const titleHtml = event.link
        ? `<a href="${event.link}" target="_blank" rel="noopener">${event.title}</a>`
        : event.title;

      return `
        <div class="event-card">
          ${imageHtml}
          <div class="event-card-body">
            <h3 class="event-card-title">${titleHtml}</h3>
            ${event.timeline ? `<div class="event-card-meta"><span class="event-card-label">Date:</span> <span>${event.timeline}</span></div>` : ''}
            ${event.location ? `<div class="event-card-meta"><span class="event-card-label">Location:</span> <span>${event.location}</span></div>` : ''}
            <p class="event-card-desc">${event.description}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  function setupEventTabs(events) {
    const buttons = tabContainer.querySelectorAll('.event-tab-btn');

    // Auto-select the right default tab: show "upcoming" if there are upcoming events, otherwise "past"
    const hasUpcoming = events.some(e => eventStatus(e) === 'upcoming');
    const defaultStatus = hasUpcoming ? 'upcoming' : 'past';

    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === defaultStatus);
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderEvents(events, btn.dataset.status);
      });
    });

    renderEvents(events, defaultStatus);
  }
}

// --- Minimal CSV parser (no dependencies) ---
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || '';
    });
    return obj;
  }).filter(obj => Object.values(obj).some(v => v)); // Filter empty rows
}
