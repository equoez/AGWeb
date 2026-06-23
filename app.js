/* ============================================================
   Utilities
   ============================================================ */
const nameToSlug = n => n.toLowerCase().replace(/[^a-z0-9]/g,'');
const setHTML    = (id, html) => document.getElementById(id).innerHTML = html;
/* Lets keyboard users activate role="button" cards with Enter or Space */
function activateOnKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
}
const json       = (url, cb, err) => fetch(url)
    .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`); return r.json(); })
    .then(cb)
    .catch(e => { console.error('Fetch failed:', e); (err || (() => {}))(e); });

/* Render a block of plain text as paragraphs: blank lines split paragraphs,
   single newlines become <br>. Used by every long-form reader. */
const paragraphs = text => (text || '')
    .split(/\n\n+/)
    .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('');

/* Standard "could not load" message; styled via CSS (.load-error). */
function loadError(target, file) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (el) el.innerHTML = `<p class="load-error">Could not load <em>sources/${file}</em>.</p>`;
}

/* ============================================================
   Navbar
   ------------------------------------------------------------
   Top level shows a short row; pages under "Chronicle" are tucked
   into a dropdown to keep the bar light. `NAV` drives both the
   markup and the active-highlight logic, so adding/moving a page
   is a one-line change here.
   ============================================================ */
const NAV = [
    { type: 'link',  page: 'home',   label: 'Home'   },
    { type: 'link',  page: 'enlist', label: 'Enlist' },
    { type: 'link',  page: 'members', label: 'Members' },
    { type: 'group', label: 'Library', pages: ['codex','ranks','diplomacy','missions','library'] },
];
/* Lookup: page id -> the group label it lives under (for active highlighting) */
const PAGE_GROUP = {};
NAV.filter(n => n.type === 'group').forEach(g =>
    g.pages.forEach(pg => { PAGE_GROUP[pg] = g.label; })
);
/* All navigable page ids, derived from NAV so it never drifts out of sync.
   ('character' is a detail view reached via slug, not a nav entry.) */
const PAGES = NAV.flatMap(n => n.type === 'group' ? n.pages : [n.page]);
const cap = p => p[0].toUpperCase() + p.slice(1);
/* Explicit labels for pages whose dropdown name differs from the page id */
const PAGE_LABEL = { library: 'Stories' };
const navLabel = p => PAGE_LABEL[p] || cap(p);

setHTML('navbar', NAV.map(item => {
    if (item.type === 'link') {
        return `<button class="nav-button" data-nav="${item.page}" onclick="showPage('${item.page}')">${item.label}</button>`;
    }
    /* Dropdown group */
    const menu = item.pages.map(pg =>
        `<button class="nav-menu-item" data-nav="${pg}" role="menuitem"
            onclick="showPage('${pg}'); closeNavMenus();">${navLabel(pg)}</button>`
    ).join('');
    return `
        <div class="nav-group" data-group="${item.label}">
            <button class="nav-button nav-group-toggle" aria-haspopup="true" aria-expanded="false"
                onclick="toggleNavMenu(this)">
                ${item.label}<span class="nav-caret" aria-hidden="true">&#9662;</span>
            </button>
            <div class="nav-menu" role="menu">${menu}</div>
        </div>`;
}).join(''));

/* ── Dropdown open/close ── */
function toggleNavMenu(btn) {
    const group = btn.closest('.nav-group');
    const isOpen = group.classList.contains('open');
    closeNavMenus();
    if (!isOpen) {
        group.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
    }
}
function closeNavMenus() {
    document.querySelectorAll('.nav-group.open').forEach(g => {
        g.classList.remove('open');
        g.querySelector('.nav-group-toggle')?.setAttribute('aria-expanded', 'false');
    });
}
/* Close when clicking outside, or on Escape */
document.addEventListener('click', e => { if (!e.target.closest('.nav-group')) closeNavMenus(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNavMenus(); });

/* ── Active-page highlight ── */
/* Marks the current page's button active; if it lives in a group,
   the group's toggle is highlighted instead. */
function updateNavActive(pageId) {
    document.querySelectorAll('#navbar .nav-button, #navbar .nav-menu-item')
        .forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#navbar .nav-group-toggle')
        .forEach(b => b.classList.remove('active'));

    document.querySelector(`#navbar [data-nav="${pageId}"]`)?.classList.add('active');
    const groupLabel = PAGE_GROUP[pageId];
    if (groupLabel) {
        document.querySelector(`#navbar .nav-group[data-group="${groupLabel}"] .nav-group-toggle`)
            ?.classList.add('active');
    }
}

/* ============================================================
   Simple pages (home, enlist)
   ============================================================ */
function loadSimple(page, file) {
    const el = document.getElementById(page + '-content');
    if (el.dataset.loaded) return;
    el.dataset.loaded = '1';
    json('sources/' + file, d => {
        el.innerHTML = (d.title ? `<h2>${d.title}</h2>` : '') + (d.body || '');
    }, () => loadError(el, file));
}

/* ============================================================
   Codex
   ============================================================ */
function loadCodex() {
    const el = document.getElementById('codex-content');
    if (el.dataset.loaded) return;
    el.dataset.loaded = '1';
    json('sources/codex.json', d => {
        el.innerHTML = (d.title ? `<h2>${d.title}</h2>` : '')
            + (d.intro  ? `<p>${d.intro}</p>` : '')
            + '<div class="section">'
            + (d.items || []).map(it =>
                `<div class="codex-item">
                    <img src="img/main/FWD_Fist.png" class="codex-icon" alt="">
                    <div><strong>${it.title}</strong> ${it.text}</div>
                </div>`
            ).join('')
            + '</div>';
    }, () => loadError('codex-content', 'codex.json'));
}

/* ============================================================
   Ranks
   ============================================================ */
let RANK_MAP = new Map();

/* Pre-load rank map so badges are correct before the Ranks page is visited */
let rankMapReady = fetch('sources/ranks.json')
    .then(r => r.json())
    .then(d => { RANK_MAP = new Map((d.ranks || []).map(r => [r.name, r.key])); })
    .catch(e => console.error('Could not preload ranks:', e));

function loadRanks() {
    const el = document.getElementById('ranks-content');
    if (el.dataset.loaded) return;
    el.dataset.loaded = '1';
    json('sources/ranks.json', d => {
        RANK_MAP = new Map((d.ranks || []).map(r => [r.name, r.key]));
        el.innerHTML = (d.title ? `<h2>${d.title}</h2>` : '')
            + (d.ranks || []).filter(r => r.desc).map(r =>
                `<div class="rank-item">
                    <img src="img/ranks/ranks_${r.key}_rankbadge.png" class="rank-icon" alt="${r.name} badge">
                    <div class="rank-text"><strong>${r.name}</strong><span>${r.desc}</span></div>
                </div>`
            ).join('');
    }, () => loadError('ranks-content', 'ranks.json'));
}

const badgeSrc = rank => `img/ranks/ranks_${RANK_MAP.get(rank) || 'initiate'}_rankbadge.png`;

/* ============================================================
   Members
   ============================================================ */
let characterData = [];

function loadMembers() {
    const list = document.getElementById('members-list');
    if (list.dataset.loaded) return;
    list.dataset.loaded = '1';
    json('sources/characters.json', chars => {
        characterData = chars;
        rankMapReady.then(() => setHTML('members-list', chars.map((c, i) => {
            if (!c.rank) return '';
            const icon = c.sheet
                ? `<a class="sheet-icon-link" href="#${nameToSlug(c.name)}" onclick="showCharacterSheet(${i});return false;" title="View character sheet">
                       <img class="sheet-icon" src="img/icons/journal_history_binder.png" alt="Character sheet">
                   </a>`
                : '';
            return `<div class="member-card">
                <img class="member-badge" src="${badgeSrc(c.rank)}" alt="${c.rank} badge" loading="lazy" decoding="async">
                <div class="member-info">
                    <div class="member-name">${c.name}${icon}</div>
                    <div class="member-rank-label">${c.rank}</div>
                </div>
                ${c.points > 0 ? `<div class="member-points"><span class="member-points-number">${c.points}</span><img class="member-points-icon" src="img/icons/heroicscroll.png" alt="points"></div>` : ''}
            </div>`;
        }).join('')));
    }, () => {
        document.getElementById('members-error').style.display = 'block';
    });
}

/* ============================================================
   Character Sheet
   ============================================================ */
function showCharacterSheet(index) {
    const c = characterData[index];
    if (!c?.sheet) return;
    const bio = c.sheet.bio || '';
    setHTML('char-sheet-content', `
        <div class="char-header">
            <div class="char-name">${c.name}</div>
            <div class="char-meta">
                <img class="char-badge" src="${badgeSrc(c.rank)}" alt="${c.rank} badge">
                <span class="char-rank">${c.rank}</span>
                <span class="char-separator">·</span>
                <span class="char-order">Order of the Argent Gryphon</span>
            </div>
        </div>
        ${c.sheet.portrait ? `<div class="char-portrait-wrap"><img class="char-portrait" src="${c.sheet.portrait}" alt="Portrait of ${c.name}" loading="lazy" decoding="async"></div><div class="char-rule"></div>` : ''}
        <div class="char-body">${typeof bio === 'string' ? bio : bio.map(p => `<p>${p}</p>`).join('')}</div>
    `);
    showPage('character', false);
    try { history.pushState({ page: 'character', slug: nameToSlug(c.name) }, '', '/#' + nameToSlug(c.name)); } catch(e) {}
}

function tryOpenCharacterBySlug(slug) {
    const open = chars => {
        const idx = chars.findIndex(c => c.sheet && nameToSlug(c.name) === slug);
        if (idx !== -1) { showCharacterSheet(idx); return true; }
        return false;
    };
    if (characterData.length) {
        if (!open(characterData)) showPage('home');
        return;
    }
    json('sources/characters.json',
        chars => { characterData = chars; if (!open(chars)) showPage('home'); },
        () => showPage('home'));
}

/* ============================================================
   Library
   ============================================================
   Data lives in sources/journal.json — an array of series:
     [ { name, entries: [ { title, body }, … ] }, … ]
   To add a new series, append an object to that array.
   ============================================================ */
let LIB_SERIES       = [];
let libCurrentSeries = null;
let libCurrentIdx    = 0;
let libReady         = false;

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X',
               'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];

function initLibrary() {
    if (libReady) return;
    libReady = true;
    json('sources/journal.json', data => {
        LIB_SERIES = data;
        const grid = document.getElementById('lib-series-grid');
        grid.innerHTML = '<div class="section">'
            + LIB_SERIES.map((s, si) => {
                const count = s.entries.length;
                return `<div class="codex-item library-series-item" role="button" tabindex="0" onclick="libOpenSeries(${si})" onkeydown="activateOnKey(event)">
                    <img src="img/main/quill.png" class="lib-series-bigbook codex-icon" alt="">
                    <div>
                        <strong>${s.name}</strong>
                        <div class="library-series-count">${count === 1 ? '1 volume' : count + ' volumes'}</div>
                    </div>
                </div>`;
            }).join('')
            + '</div>';
    }, () => loadError('lib-series-grid', 'journal.json'));
}

function libOpenSeries(si, pushHistory = true) {
    libCurrentSeries = si;
    const entries = LIB_SERIES[si].entries || [];

    document.getElementById('lib-shelf-view').style.display  = 'none';
    document.getElementById('lib-reader-view').style.display = 'block';
    document.getElementById('lib-series-title').textContent  = LIB_SERIES[si].name;

    /* Build book shelf */
    const shelf = document.getElementById('lib-book-shelf');
    shelf.innerHTML = entries.map((e, i) => {
        const num = ROMAN[Math.min(i, 19)];
        return `<button class="lib-book-btn${i === 0 ? ' active' : ''}"
                        title="${e.title}"
                        onclick="libShowChapter(${i})"
                        id="lib-book-${i}">
                    <img src="img/main/${num}.png" alt="Chapter ${i + 1}">
                </button>`;
    }).join('');

    libCurrentIdx = 0;
    libShowChapter(0);
    if (pushHistory) try { history.pushState({ page: 'library', series: si, chapter: 0 }, '', '/#library'); } catch(e) {}
}

function libShowChapter(i) {
    const entries = LIB_SERIES[libCurrentSeries]?.entries || [];
    if (!entries.length) return;
    libCurrentIdx = i;
    const e = entries[i];

    document.getElementById('lib-chapter-title').textContent = e.title;
    setHTML('lib-chapter-body', paragraphs(e.body));

    document.querySelectorAll('.lib-book-btn').forEach((b, j) =>
        b.classList.toggle('active', j === i)
    );
}

function libShowShelf(pushHistory = true) {
    document.getElementById('lib-shelf-view').style.display  = 'block';
    document.getElementById('lib-reader-view').style.display = 'none';
    if (pushHistory) try { history.pushState({ page: 'library' }, '', '/#library'); } catch(e) {}
}

/* ============================================================
   Document sections (Diplomacy & Missions)
   ============================================================
   Both pages are the same shape: a grid of cards that each open a
   full-text article. makeDocSection() builds one such page; the two
   instances below differ only in element-id prefix, data file, and
   a couple of labels.

   Data lives in sources/<file> — an array of documents:
     [
       {
         "title": "The Silver Compact",
         "category": "Treaty",            ← free-form; shown as a pill/badge
         "image": "img/main/some.png",    ← optional; falls back to parchment
         "description": "Optional intro shown above the body.",
         "body": "Full text…\n\nBlank lines separate paragraphs."
                  // if the body contains HTML tags it is rendered as-is
       },
       …
     ]
   ============================================================ */
const DOC_FALLBACK_IMG = 'img/main/diplomacy_treaties_parchment.png';

function makeDocSection({ prefix, page, file, emptyNoun, defaultCategory }) {
    let docs  = [];
    let ready = false;
    const $ = id => document.getElementById(`${prefix}-${id}`);

    function init() {
        if (ready) return;
        ready = true;
        json('sources/' + file, data => {
            docs = data;
            const grid = $('doc-grid');
            if (!docs.length) {
                grid.innerHTML = `<p class="empty-note">No ${emptyNoun} on record.</p>`;
                return;
            }
            grid.innerHTML = '<div class="section">'
                + docs.map((doc, idx) =>
                    `<div class="codex-item library-series-item" role="button" tabindex="0" onclick="${prefix}OpenDoc(${idx})" onkeydown="activateOnKey(event)">
                        <img src="${doc.image || DOC_FALLBACK_IMG}" class="${prefix}-doc-thumb" alt="" loading="lazy" decoding="async">
                        <div>
                            <strong>${doc.title}</strong>
                            <div class="library-series-count ${prefix}-category-pill">${doc.category || defaultCategory}</div>
                        </div>
                    </div>`
                ).join('')
                + '</div>';
        }, () => loadError($('doc-grid'), file));
    }

    function openDoc(idx) {
        const doc = docs[idx];
        if (!doc) return;

        $('article-title').textContent    = doc.title;
        $('article-category').textContent = doc.category || '';

        /* Optional description shown above the body */
        const descEl = $('article-desc');
        if (descEl) {
            descEl.innerHTML = doc.description || '';
            descEl.style.display = doc.description ? 'block' : 'none';
        }

        /* Render body: raw HTML if it looks like markup, else paragraphs */
        const rawBody = doc.body || '';
        const isHTML  = /<[a-z][\s\S]*>/i.test(rawBody);
        setHTML(`${prefix}-article-body`, isHTML ? rawBody : paragraphs(rawBody));

        /* Swap the header image */
        const bigImg = document.querySelector(`#${prefix}-article-view .lib-reader-bigbook`);
        if (bigImg) bigImg.src = doc.image || DOC_FALLBACK_IMG;

        $('shelf-view').style.display   = 'none';
        $('article-view').style.display = 'block';
        try { history.pushState({ page, doc: idx }, '', '/#' + page); } catch(e) {}
        window.scrollTo(0, 0);
    }

    function showShelf(pushHistory = true) {
        $('shelf-view').style.display   = 'block';
        $('article-view').style.display = 'none';
        if (pushHistory) try { history.pushState({ page }, '', '/#' + page); } catch(e) {}
    }

    return { init, openDoc, showShelf };
}

const Diplomacy = makeDocSection({
    prefix: 'dip', page: 'diplomacy', file: 'diplomacy.json',
    emptyNoun: 'documents', defaultCategory: 'Document',
});
const Missions = makeDocSection({
    prefix: 'mis', page: 'missions', file: 'mission.json',
    emptyNoun: 'missions', defaultCategory: 'Mission',
});

/* Thin globals so inline onclick="dipOpenDoc(…)" etc. keep working */
const initDiplomacy = () => Diplomacy.init();
const dipOpenDoc     = idx => Diplomacy.openDoc(idx);
const dipShowShelf   = (p = true) => Diplomacy.showShelf(p);
const initMission    = () => Missions.init();
const misOpenDoc     = idx => Missions.openDoc(idx);
const misShowShelf   = (p = true) => Missions.showShelf(p);

/* ============================================================
   Page switching
   ============================================================ */
function showPage(pageId, pushHistory = true) {
    updateNavActive(pageId);
    document.querySelector('.page.active')?.classList.remove('active');
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

    if (pageId === 'home')      loadSimple('home', 'homepage.json');
    if (pageId === 'enlist')    loadSimple('enlist', 'enlist.json');
    if (pageId === 'diplomacy') {
        initDiplomacy();
        if (document.getElementById('dip-article-view')?.style.display !== 'none') {
            dipShowShelf();
            return;
        }
    }
    if (pageId === 'missions') {
        initMission();
        if (document.getElementById('mis-article-view')?.style.display !== 'none') {
            misShowShelf();
            return;
        }
    }
    if (pageId === 'codex')     loadCodex();
    if (pageId === 'ranks')     loadRanks();
    if (pageId === 'members')   loadMembers();
    if (pageId === 'library') {
        initLibrary();
        /* If already inside a series, clicking Library returns to the shelf */
        if (document.getElementById('lib-reader-view')?.style.display !== 'none') {
            libShowShelf();
            return;
        }
    }

    if (pushHistory) try { history.pushState({ page: pageId }, '', '/#' + pageId); } catch(e) {}
}

/* ============================================================
   Routing — browser back/forward & hash
   ============================================================ */
window.addEventListener('popstate', e => {
    const st = e.state;
    const h  = location.hash.slice(1);

    if (st?.page === 'diplomacy' && st.doc != null) {
        showPage('diplomacy', false);
        dipOpenDoc(st.doc);
        return;
    }
    if (st?.page === 'diplomacy') {
        showPage('diplomacy', false);
        dipShowShelf(false);
        return;
    }
    if (st?.page === 'missions' && st.doc != null) {
        showPage('missions', false);
        misOpenDoc(st.doc);
        return;
    }
    if (st?.page === 'missions') {
        showPage('missions', false);
        misShowShelf(false);
        return;
    }
    if (st?.page === 'library' && st.series != null) {
        showPage('library', false);
        libOpenSeries(st.series, false);
        return;
    }
    if (st?.page === 'library') {
        showPage('library', false);
        libShowShelf(false);
        return;
    }
    if (PAGES.includes(h)) showPage(h, false);
    else if (h)            tryOpenCharacterBySlug(h);
    else                   showPage('home', false);
    window.scrollTo(0, 0);
});

/* Mouse back/forward buttons */
window.addEventListener('mousedown', e => {
    if (e.button === 3) { e.preventDefault(); history.back(); }
    if (e.button === 4) { e.preventDefault(); history.forward(); }
});

/* Keyboard arrow navigation inside the library reader */
document.addEventListener('keydown', e => {
    const readerVisible = document.getElementById('lib-reader-view')?.style.display !== 'none'
        && document.querySelector('[data-page="library"]')?.classList.contains('active');
    if (!readerVisible) return;
    const entries = LIB_SERIES[libCurrentSeries]?.entries || [];
    if (e.key === 'ArrowLeft'  && libCurrentIdx > 0) {
        e.preventDefault();
        libShowChapter(libCurrentIdx - 1);
    }
    if (e.key === 'ArrowRight' && libCurrentIdx < entries.length - 1) {
        e.preventDefault();
        libShowChapter(libCurrentIdx + 1);
    }
});

/* Initial load from hash */
const hash = location.hash.slice(1);
if (PAGES.includes(hash)) { history.replaceState({ page: hash }, '', '/#' + hash); showPage(hash, false); }
else if (hash)             { tryOpenCharacterBySlug(hash); }
else                       { history.replaceState({ page: 'home' }, '', '/#home'); showPage('home', false); }
window.scrollTo(0, 0);

/* ============================================================
   Map magnifier
   ============================================================ */
const ZOOM = 3, LENS_SIZE = 220, HALF = LENS_SIZE / 2;
const lens = Object.assign(document.createElement('div'), { className: 'map-magnifier' });
document.body.appendChild(lens);

function renderMagnifier(clientX, clientY, img, isTouch) {
    const r  = img.getBoundingClientRect();
    const cx = Math.max(0, Math.min(clientX - r.left, r.width));
    const cy = Math.max(0, Math.min(clientY - r.top,  r.height));
    lens.style.backgroundImage    = `url('${img.src}')`;
    lens.style.backgroundSize     = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
    lens.style.backgroundPosition = `${HALF - cx * ZOOM}px ${HALF - cy * ZOOM}px`;
    lens.style.display = 'block';
    lens.style.left    = (clientX - HALF) + 'px';
    lens.style.top     = (isTouch ? clientY - LENS_SIZE - 40 : clientY - HALF) + 'px';
}

function initMagnifier(img) {
    img.addEventListener('mouseenter', () => lens.style.display = 'block');
    img.addEventListener('mouseleave', () => lens.style.display = 'none');
    img.addEventListener('mousemove',  e => renderMagnifier(e.clientX, e.clientY, img, false));
    img.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; renderMagnifier(t.clientX, t.clientY, img, true); }, { passive: false });
    img.addEventListener('touchmove',  e => { e.preventDefault(); const t = e.touches[0]; renderMagnifier(t.clientX, t.clientY, img, true); }, { passive: false });
    img.addEventListener('touchend',    () => lens.style.display = 'none');
    img.addEventListener('touchcancel', () => lens.style.display = 'none');
}

new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    (n.matches?.('.home-img') ? [n] : [...n.querySelectorAll('.home-img')]).forEach(initMagnifier);
}))).observe(document.getElementById('home-content'), { childList: true, subtree: true });

/* ============================================================
   Dark magic easter egg
   ============================================================ */
const bgEl = document.querySelector('.bg-fixed');
let dmTimer;

document.addEventListener('mouseover', e => {
    if (!e.target.classList.contains('member-points-icon')) return;
    clearTimeout(dmTimer);
    bgEl.classList.add('dark-magic', 'dark-magic-anim');
    document.body.classList.add('dark-magic-active');
});
document.addEventListener('mouseout', e => {
    if (!e.target.classList.contains('member-points-icon')) return;
    bgEl.classList.remove('dark-magic-anim');
    document.body.classList.remove('dark-magic-active');
    dmTimer = setTimeout(() => bgEl.classList.remove('dark-magic'), 30000);
});
