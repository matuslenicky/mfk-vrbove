// Statický generátor webu MFK Vrbové: data/ + src/ -> dist/   (node build.js; TODAY=2026-11-16 prepíše dnešný dátum)
// Obsah: zápasy, tabuľky a súpisky zo Sportnetu (data/sportnet.json, scripts/sportnet.mjs), údaje o klube z data/klub.json
// (len zo zverejnených zdrojov), erby súperov zo Sportnetu (scripts/logos.py). Fotky klubu: data/foto.json + media/foto-web (neskôr).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const rd = (f, def) => { const p = path.join(ROOT, 'data', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : def; };
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const club = rd('klub.json');
const sn = rd('sportnet.json');
const foto = rd('foto.json', { obrazky: {} });
const SPACE = config.sportnet.appSpace;

// ---- pomocné -------------------------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const todayISO = () => local.format(new Date()).slice(0, 10);
const TODAY = process.env.TODAY || todayISO();
const DAYS = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
const DAYS_S = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];
const MONTHS = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];
const MONTHS_G = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];
const dObj = (iso) => new Date(iso + 'T12:00:00Z');
const dShort = (iso) => { const d = dObj(iso); return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`; };
const dDay = (iso) => DAYS_S[dObj(iso).getUTCDay()];
const DAYS_ACC = ['v nedeľu', 'v pondelok', 'v utorok', 'v stredu', 'vo štvrtok', 'v piatok', 'v sobotu'];
const dWhen = (iso) => { const d = dObj(iso); return `${DAYS_ACC[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS_G[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dLong = (iso) => { const d = dObj(iso); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS_G[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dFull = (iso) => { const d = dObj(iso); return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`; };
const monthKey = (iso) => iso.slice(0, 7);
const monthName = (key) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
// okamih výkopu s posunom časového pásma (letný čas) pre odpočet v prehliadači
function isoLocal(date, time = '12:00') {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const [ld, lt] = local.format(new Date(guess)).split(' ');
  const shown = Date.UTC(...ld.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)), ...lt.split(':').map(Number));
  const off = (shown - guess) / 6e4;
  return `${date}T${time}:00+${String(Math.floor(off / 60)).padStart(2, '0')}:${String(off % 60).padStart(2, '0')}`;
}
const acc = (league) => league.replace(/\bliga\b/, 'ligu'); // 4. pád: hrajú V. ligu
const tel = (n) => 'tel:' + n.replace(/\s+/g, '');
const SEASON = sn.season.replace(/^(\d{4})\/\d\d(\d\d)$/, '$1/$2');

// ---- súťaže, tímy, zápasy ------------------------------------------------------------------------
const compName = (name) => club.sutaze[name] || club.sutaze[name.replace(/\s+/g, ' ')] || name.replace(/\s+/g, ' ').replace(/-ObFZ TT/, ' ObFZ Trnava').replace(/-/g, ' ');
const ROUND = (r) => (/^\d+$/.test(r) ? `${r}. kolo` : String(r || '').replace(/\.\s*kolo/i, '. kolo').replace(/Kolo/, 'kolo'));
const teams = sn.teams.map((t) => {
  const league = t.competitions.find((c) => !c.cup);
  const table = league ? sn.tables[league.key] : null;
  const pos = table?.rows.find((r) => r.our);
  return {
    ...t, url: `timy/${t.slug}/`, code: t.adult ? t.slug[0] : norm(t.short).replace(/-/g, ''),
    full: t.adult ? t.short : `${t.short} ${t.sub}`,
    leagueName: league ? compName(league.name) : '', leagueKey: league?.key || '', table, pos: pos?.pos || null, of: table?.rows.length || 0,
  };
});
const bySlug = Object.fromEntries(teams.map((t) => [t.slug, t]));
// kolá bez súpera (voľno) sa v zoznamoch nezobrazujú, inak by ostal prázdny riadok
const matches = sn.matches.filter((m) => String(m.opponent || '').trim()).map((m) => {
  const t = bySlug[m.team];
  const past = m.played || m.date < TODAY;
  let gf = null, ga = null, res = null;
  // prípravky (U11 a mladší) výsledok nezapisujú, Sportnet pri nich dáva 0:0 bez gólov
  if (m.score === '0:0' && !(m.goals || []).length && /^U(\d|1[01])\b/.test(t.short)) m = { ...m, score: null };
  if (m.score) { const [h, a] = m.score.split(':').map(Number); [gf, ga] = m.home ? [h, a] : [a, h]; res = gf > ga ? 'w' : gf < ga ? 'l' : 'd'; }
  const slug = `${m.date}-${t.code}-${norm(m.opponent)}`;
  return { ...m, past, gf, ga, res, slug, url: `zapasy/${slug}/`, comp: compName(m.competition), roundName: ROUND(m.round), teamObj: t, cup: /cup|pohár/i.test(m.competition) };
});
const teamMatches = (slug) => matches.filter((m) => m.team === slug);
const upcoming = matches.filter((m) => !m.past);
const results = matches.filter((m) => m.past).reverse();
const RES = { w: 'Výhra', d: 'Remíza', l: 'Prehra' };
const RES_S = { w: 'V', d: 'R', l: 'P' };

// strelci tímu v sezóne (vlastné góly sa nerátajú)
function scorers(slug) {
  const c = new Map();
  for (const m of teamMatches(slug)) for (const g of m.goals || []) if (g.side === 'our' && g.kind !== 'own' && g.player) c.set(g.player, (c.get(g.player) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sk'));
}
function record(slug) {
  const r = { w: 0, d: 0, l: 0, gf: 0, ga: 0, n: 0 };
  for (const m of teamMatches(slug)) if (m.res) { r[m.res]++; r.gf += m.gf; r.ga += m.ga; r.n++; }
  return r;
}

// ---- obrázky -----------------------------------------------------------------------------------
const logoFile = (space) => space && fs.existsSync(path.join(SRC, 'img', 'kluby', `${space}.webp`));
const initials = (name) => String(name).replace(/^(TJ|OŠK|OFK|ŠK|FK|FC|MFK|MŠK|PFK|TFK|PŠK|ZFC|OTJ|Telovýchovná jednota)\s+/i, '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function logo(space, name, R, size = 40, eager = false) {
  if (space === SPACE) return `<img class="logo" src="${R}img/erb-128.webp" alt="" width="${Math.round(size * 0.78)}" height="${size}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
  if (logoFile(space)) return `<img class="logo" src="${R}img/kluby/${space}.webp" alt="" width="${size}" height="${size}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
  return `<span class="logo logo--txt" aria-hidden="true">${esc(initials(name))}</span>`;
}
// fotky klubu (doplnia sa neskôr): data/foto.json { obrazky: { kľúč: { widths: [480, 960, …], alt } } } -> dist/foto/<kľúč>-<šírka>.webp
function pic(key, R, { sizes = '100vw', cls = '', alt, eager = false } = {}) {
  const f = foto.obrazky?.[key];
  if (!f) return '';
  const set = f.widths.map((w) => `${R}foto/${key}-${w}.webp ${w}w`).join(', ');
  const w = f.widths.at(-1);
  return `<img class="${cls}" src="${R}foto/${key}-${w}.webp" srcset="${set}" sizes="${sizes}" alt="${esc(alt ?? f.alt ?? '')}" width="${w}" height="${f.h ? Math.round((f.h * w) / f.w) : Math.round(w * 0.5625)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}

// ---- ikony (Lucide, ISC) -------------------------------------------------------------------------
const ico = (p, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  phone: ico('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  mail: ico('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
  pin: ico('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
  route: ico('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>'),
  cal: ico('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  ext: ico('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  doc: ico('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
  fb: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.6 1.6-1.6h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H8v3h2.5V21z"/></svg>',
  down: ico('<path d="m6 9 6 6 6-6"/>'),
  ball: ico('<circle cx="12" cy="12" r="10"/><path d="m12 7 4.2 3-1.6 5H9.4L7.8 10z"/><path d="M12 2v5M21.5 9.5 16.2 10M18 20l-3.4-5M6 20l3.4-5M2.5 9.5l5.3.5"/>'),
};

// ---- CSP a rozloženie ----------------------------------------------------------------------------
// GitHub Pages nedovolí hlavičky, preto <meta>: skripty len z webu, jediný inline skript HEAD_JS povolený hashom.
const HEAD_JS = `document.documentElement.classList.add('js')`;
const sha256 = (s) => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const CONNECT = ["'self'", ...(config.supabase?.url ? [new URL(config.supabase.url).origin] : [])];
const CSP = [
  "default-src 'none'", `script-src 'self' ${sha256(HEAD_JS)}`, "style-src 'self'", "img-src 'self' data:", "font-src 'self'",
  `connect-src ${CONNECT.join(' ')}`, "base-uri 'none'", "form-action 'none'", "object-src 'none'", "manifest-src 'self'",
].join('; ');

const NAV = [['zapasy/', 'Zápasy'], ['tabulky/', 'Tabuľky'], ['timy/', 'Tímy'], ['klub/', 'Klub'], ['stadion/', 'Štadión'], ['kontakt/', 'Kontakt']];
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${club.stadion.geo.join(',')}`;
const mapyUrl = `https://mapy.com/fnc/v1/showmap?mapset=basic&amp;center=${club.stadion.geo[1]},${club.stadion.geo[0]}&amp;zoom=16&amp;marker=true`; // mapy.com/s/?q= vracia 404

function layout({ route, title, desc, body, active, bodyClass = '' }) {
  const depth = route.split('/').filter(Boolean).length;
  const R = depth ? '../'.repeat(depth) : './';
  const cur = (u) => (active && active === u ? ' aria-current="page"' : '');
  const fullTitle = (config.ukazka ? 'Návrh webu – ' : '') + (route ? `${title} | ${club.nazov}` : `${club.nazov} – ${title}`);
  const canon = config.siteUrl ? `${config.siteUrl}${route}` : '';
  const ld = route ? '' : `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'SportsClub', name: club.nazov, legalName: club.pravnyNazov, sport: 'Futbal', foundingDate: String(club.zalozenie),
    email: club.kontakt.email, telephone: club.kontakt.telefon.replace(/\s+/g, ''),
    address: { '@type': 'PostalAddress', streetAddress: club.adresa[0], postalCode: club.adresa[1].slice(0, 6), addressLocality: club.mesto, addressCountry: 'SK' },
    location: { '@type': 'StadiumOrArena', name: club.stadion.nazov, maximumAttendeeCapacity: club.stadion.kapacita, geo: { '@type': 'GeoCoordinates', latitude: club.stadion.geo[0], longitude: club.stadion.geo[1] } },
    sameAs: [club.facebook, club.sportnetUrl],
  }).replace(/</g, '\\u003c')}</script>`;
  return `<!doctype html>
<html lang="sk" data-root="${R}"${config.ukazka ? ' class="has-demo"' : ''}>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc || `${club.nazov} – futbal vo Vrbovom od roku ${club.zalozenie}. Zápasy, výsledky, tabuľky a súpisky všetkých tímov.`)}">
${config.noindex ? '<meta name="robots" content="noindex">\n' : ''}${canon ? `<link rel="canonical" href="${canon}">\n` : ''}<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="sk_SK">
<meta name="theme-color" content="#f6c400">
<link rel="icon" type="image/png" href="${R}img/favicon.png">
<link rel="apple-touch-icon" href="${R}img/apple-touch-icon.png">
<link rel="preload" href="${R}fonts/big-shoulders-display-900.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="${R}fonts/schibsted-grotesk-400.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${R}css/site.css">
<script>${HEAD_JS}</script>
<script type="module" src="${R}js/site.mjs"></script>
${ld}</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#obsah">Preskočiť na obsah</a>
<header class="hdr" id="hdr">${config.ukazka ? `
  <p class="demo">Návrh webu, nie oficiálna stránka klubu</p>` : ''}
  <div class="wrap hdr-in">
    <a class="brand" href="${R}"${route ? '' : ' aria-current="page"'}><img src="${R}img/erb-64.webp" alt="" width="34" height="44"><span>${esc(club.nazov)}</span></a>
    <button class="burger" type="button" aria-expanded="false" aria-controls="menu"><span class="burger-i" aria-hidden="true"></span><span class="burger-t">Menu</span></button>
    <nav class="nav" id="menu" aria-label="Hlavné menu">
      <ul class="nav-l">${NAV.map(([u, t]) => `<li><a href="${R}${u}"${cur(u)}>${t}</a></li>`).join('')}</ul>
      <a class="nav-fb" href="${club.facebook}" rel="noopener">${I.fb}<span>Facebook klubu</span></a>
    </nav>
  </div>
</header>
<main id="obsah">
${body}
</main>
<footer class="ftr">
  <div class="wrap ftr-grid">
    <div class="ftr-club">
      <img src="${R}img/erb-128.webp" alt="" width="62" height="80" loading="lazy">
      <div><p class="ftr-name">${esc(club.nazov)}</p><p>${esc(club.pravnyNazov)}<br>futbal vo Vrbovom od roku ${club.zalozenie}</p></div>
    </div>
    <div><h2 class="ftr-h">Štadión</h2><p>${esc(club.stadion.nazov)}<br>${club.stadion.adresa.map(esc).join(', ')}</p><p><a href="${mapsUrl}" rel="noopener">Navigovať</a></p></div>
    <div><h2 class="ftr-h">Kontakt</h2><p>${esc(club.kontakt.osoba)}<br><a href="${tel(club.kontakt.telefon)}">${esc(club.kontakt.telefon)}</a><br><a href="mailto:${club.kontakt.email}">${esc(club.kontakt.email)}</a></p><p><a href="${club.facebook}" rel="noopener">Facebook klubu</a></p></div>
    <div><h2 class="ftr-h">Výsledky a tabuľky</h2><p>Zo Sportnetu (Futbalnet), aktualizované ${dFull(sn.updated.slice(0, 10))}. Zápisy o stretnutí sú na <a href="${club.sportnetUrl}" rel="noopener">sportnet.sme.sk</a>.</p></div>
  </div>
  <div class="ftr-bar"><div class="wrap ftr-bar-in"><span>© ${new Date().getFullYear()} ${esc(club.pravnyNazov)}</span><a href="${R}ochrana-sukromia/">Ochrana súkromia</a>${config.adminDemo ? `<a href="${R}admin/">Administrácia (ukážka)</a>` : ''}</div></div>
</footer>
</body>
</html>
`;
}

// ---- spoločné bloky ------------------------------------------------------------------------------
const pageHead = ({ title, sub = '', crumbs = [], R, aside = '' }) => `<section class="phead"><div class="wrap phead-in">
  <div>${crumbs.length ? `<nav class="crumbs" aria-label="Omrvinky"><a href="${R}">Úvod</a>${crumbs.map(([u, t]) => u ? `<a href="${R}${u}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`).join('')}</nav>` : ''}
  <h1 class="h1">${esc(title)}</h1>${sub ? `<p class="phead-sub">${sub}</p>` : ''}</div>${aside}
</div></section>`;
const secHead = (h, id, more = '') => `<div class="sec-head"><h2 class="h2" id="${id}">${h}</h2>${more}</div>`;
const more = (href, t) => `<a class="more" href="${href}">${t}</a>`;

// tabuľa: najbližší zápas alebo výsledok, ako stará tabuľa na dedinskom štadióne (plechové tabuľky s číslami)
function board(m, R, { big = false, label = '' } = {}) {
  const us = { name: club.nazov, space: SPACE }, them = { name: m.opponent, space: m.oppSpace };
  const [h, a] = m.home ? [us, them] : [them, us];
  const side = (t, cls) => `<div class="bt ${cls}">${logo(t.space, t.name, R, big ? 64 : 48, big)}<span class="bt-name">${esc(t.space === SPACE ? (m.teamObj.adult ? club.nazov : `${club.nazov} ${m.teamObj.short}`) : t.name)}</span></div>`;
  let mid, foot;
  if (m.score) {
    const [sh, sa] = m.score.split(':');
    mid = `<div class="bscore" aria-label="Výsledok ${sh}:${sa}"><span class="plate">${sh}</span><span class="colon" aria-hidden="true">:</span><span class="plate">${sa}</span></div>`;
    foot = `${m.half ? `<span>Polčas ${esc(m.half)}</span>` : ''}<span class="res res--${m.res}">${RES[m.res]}</span>${m.detail ? `<a class="bfoot-a" href="${R}${m.url}">Góly a zostavy</a>` : ''}`;
  } else if (m.past) {
    mid = `<div class="bscore bscore--none"><span class="plate plate--wide">bez výsledku</span></div>`;
    foot = '<span>Výsledky prípraviek sa nezapisujú</span>';
  } else {
    const [hh, mm] = (m.time || '').split(':');
    mid = `<div class="bscore bscore--time" aria-label="Výkop o ${esc(m.time)}"><span class="plate">${hh}</span><span class="colon" aria-hidden="true">:</span><span class="plate">${mm}</span></div>`;
    foot = `<span class="cd" data-kickoff="${isoLocal(m.date, m.time)}" hidden></span><a class="bfoot-a" href="${R}kalendar/zapas-${m.id}.ics" download>Pridať do kalendára</a>`;
  }
  return `<article class="board${big ? ' board--big' : ''}">
  <header class="board-top"><span class="board-label">${esc(label || (m.score || m.past ? 'Posledný zápas' : 'Najbližší zápas'))}</span><span>${esc(m.teamObj.full)}</span></header>
  <p class="board-when"><time datetime="${m.date}">${dLong(m.date)}</time>${m.time && !m.score ? `, výkop ${esc(m.time)}` : ''}</p>
  <div class="board-sides"><span class="bside">Domáci</span><span class="bside">Hostia</span></div>
  <div class="board-teams">${side(h, 'bt--h')}${mid}${side(a, 'bt--a')}</div>
  <p class="board-meta">${esc(m.comp)}${m.roundName ? `, ${esc(m.roundName)}` : ''}${m.venue ? `<br>${esc(m.venue.replace(/\s+/g, ' '))}` : ''}</p>
  <footer class="board-foot">${foot}</footer>
</article>`;
}

// riadok zápasu v zozname
function matchRow(m, R, { showTeam = true } = {}) {
  // malá dedinská tabuľa: každá číslica skóre (alebo času výkopu) na vlastnej plechovej tabuľke
  const plates = (txt, cls) => [...String(txt)].map((c) => (/\d/.test(c) ? `<span class="pl8 ${cls}">${c}</span>` : `<span class="pl8-c">${esc(c)}</span>`)).join('');
  const right = m.score
    ? `<span class="pl8s" title="${RES[m.res]}"><span class="sr">${RES[m.res]}, výsledok ${esc(m.score)}</span><span aria-hidden="true">${plates(m.score, '')}</span></span>`
    : m.past ? '<span class="pl8s pl8s--none">bez výsl.</span>' : `<span class="pl8s"><span class="sr">výkop ${esc(m.time || '')}</span><span aria-hidden="true">${plates(m.time || '--:--', 'pl8--y')}</span></span>`;
  const href = m.detail || !m.past ? ` href="${R}${m.url}"` : '';
  const tag = href ? 'a' : 'div';
  return `<li class="mrow" data-team="${m.team}" data-where="${m.home ? 'doma' : 'vonku'}"><${tag} class="vb${m.res ? ` vb--${m.res}` : ''}"${href}>
  <span class="vb-d"><time datetime="${m.date}">${dShort(m.date)}</time><span>${dDay(m.date)}</span></span>
  <span class="vb-o"><span class="vb-n">${esc(m.opponent)}</span><span class="vb-k">${showTeam ? `<b>${esc(m.teamObj.short)}</b> ` : ''}${m.home ? 'doma' : 'vonku'}, ${esc(m.cup ? m.comp : m.roundName || m.comp)}</span></span>
  ${right}
</${tag}></li>`;
}
const matchList = (list, R, opts) => `<ol class="mlist">${list.map((m) => matchRow(m, R, opts)).join('')}</ol>`;

function tableHtml(tb, R, { compact = false, caption = '' } = {}) {
  let rows = tb.rows;
  if (compact) { const i = rows.findIndex((r) => r.our); const from = Math.max(0, Math.min(i - 2, rows.length - 5)); rows = rows.slice(from, from + 5); }
  return `<div class="tbl-wrap"><table class="tbl">${caption ? `<caption>${caption}</caption>` : ''}
  <thead><tr><th scope="col"><abbr title="Poradie">#</abbr></th><th scope="col" class="tl">Tím</th><th scope="col"><abbr title="Zápasy">Z</abbr></th><th scope="col" class="hm"><abbr title="Výhry">V</abbr></th><th scope="col" class="hm"><abbr title="Remízy">R</abbr></th><th scope="col" class="hm"><abbr title="Prehry">P</abbr></th><th scope="col">Skóre</th><th scope="col"><abbr title="Body">B</abbr></th></tr></thead>
  <tbody>${rows.map((r) => `<tr${r.our ? ' class="our"' : ''}><td>${r.pos}.</td><th scope="row" class="tl"><span class="tteam">${logo(r.space, r.name, R, 24)}<span>${esc(r.name)}</span></span></th><td>${r.played}</td><td class="hm">${r.won}</td><td class="hm">${r.draw}</td><td class="hm">${r.lost}</td><td class="nw">${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody>
</table></div>`;
}
const formHtml = (slug, n = 5) => {
  const last = teamMatches(slug).filter((m) => m.res).slice(-n);
  return last.length ? `<ol class="form" aria-label="Forma: posledných ${last.length} zápasov">${last.map((m) => `<li class="res-bg--${m.res}" title="${dShort(m.date)} ${esc(m.opponent)} ${m.score}"><span aria-hidden="true">${RES_S[m.res]}</span><span class="sr">${RES[m.res]} ${esc(m.opponent)} ${m.score}</span></li>`).join('')}</ol>` : '';
};

// kalendár zápasov (.ics): odber cez webcal/Google doplní site.mjs, inak stiahnutie
const calBox = (file, R, id) => `<details class="cal" data-cal id="${id}">
  <summary class="btn btn--line">${I.cal}<span>Zápasy do kalendára</span></summary>
  <div class="cal-pop">
    <a class="cal-o" data-webcal href="${R}kalendar/${file}" hidden><b>Odoberať v telefóne</b><span>iPhone, Mac, Outlook – rozpis sa sám aktualizuje</span></a>
    <a class="cal-o" data-gcal href="${R}kalendar/${file}" rel="noopener" hidden><b>Pridať do Google Kalendára</b><span>aj pre Android</span></a>
    <a class="cal-o" data-ics href="${R}kalendar/${file}" download><b>Stiahnuť súbor .ics</b><span>jednorazovo, bez aktualizácií</span></a>
  </div>
</details>`;

// výber zápasu na tabuľu: zápas v najbližších 7 dňoch, inak posledný odohraný (zimná prestávka), inak najbližší
function boardPick(slug) {
  const list = teamMatches(slug);
  const next = list.find((m) => !m.past);
  const last = [...list].reverse().find((m) => m.past && (m.score || !m.teamObj.adult));
  const soon = next && (dObj(next.date) - dObj(TODAY)) / 864e5 <= 7;
  return soon ? next : last || next;
}

// ---- stránky -----------------------------------------------------------------------------------
const pages = [];
const add = (route, opts) => pages.push({ route, ...opts });
const A = teams[0];
const crewRole = { coach: 'Tréner', assist_coach: 'Asistent trénera', manager: 'Vedúci mužstva', doctor: 'Lekár', physiotherapist: 'Fyzioterapeut', masseur: 'Masér', other: 'Člen realizačného tímu' };
const POS = [['goalkeeper', 'Brankári'], ['defender', 'Obrancovia'], ['midfielder', 'Stredopoliari'], ['forward', 'Útočníci'], ['', 'Hráči']];

// úvod
add('', {
  title: `futbal vo Vrbovom od roku ${club.zalozenie}`, active: '', bodyClass: 'home',
  body: (R) => {
    const tabs = teams.map((t) => ({ t, m: boardPick(t.slug) })).filter((x) => x.m);
    const nextAll = upcoming.slice(0, 6);
    const lastAll = results.filter((m) => m.score).slice(0, 6);
    const aRec = record(A.slug);
    const top = scorers(A.slug).slice(0, 3);
    const winterNext = upcoming[0];
    return `<section class="hero" aria-labelledby="hero-h">
  <div class="hero-field" aria-hidden="true"></div>
  <div class="wrap hero-in">
    <div class="hero-copy">
      <h1 class="hero-h" id="hero-h">Futbal vo Vrbovom od&nbsp;roku&nbsp;${club.zalozenie}</h1>
      <p class="hero-p">${esc(club.pravnyNazov)}. Muži hrajú ${esc(acc(A.leagueName))}, v klube je ${teams.length} tímov od prípravky po áčko. Domov je ${esc(club.stadion.nazov.replace('Mestský futbalový štadión', 'štadión'))}.</p>
      <p class="hero-cta"><a class="btn btn--blue" href="${R}zapasy/">Program a výsledky</a><a class="btn btn--line" href="${R}timy/">Všetky tímy</a></p>
    </div>
    <div class="hero-board">
      <div class="tabs" role="tablist" aria-label="Tabuľa podľa tímu">${tabs.map(({ t }, i) => `<button type="button" role="tab" id="tab-${t.slug}" aria-controls="tp-${t.slug}" aria-selected="${i ? 'false' : 'true'}"${i ? ' tabindex="-1"' : ''}>${esc(t.short)}</button>`).join('')}</div>
      ${tabs.map(({ t, m }, i) => `<div class="tabp" role="tabpanel" id="tp-${t.slug}" aria-labelledby="tab-${t.slug}"${i ? ' hidden' : ''}>${board(m, R, { big: true })}</div>`).join('\n      ')}
    </div>
  </div>
</section>
${winterNext && (dObj(winterNext.date) - dObj(TODAY)) / 864e5 > 14 ? `<section class="pause"><div class="wrap pause-in"><p><b>Zimná prestávka.</b> Jarná časť sa pre naše tímy začína ${dWhen(winterNext.date)}, keď <span class="nw">${esc(winterNext.teamObj.full)}</span> hrá ${winterNext.home ? 'doma proti' : 'vonku na ihrisku'} ${esc(winterNext.opponent)}.</p></div></section>` : ''}
<section class="sec" aria-labelledby="prog-h"><div class="wrap">
  ${secHead('Program a výsledky', 'prog-h', more(`${R}zapasy/`, 'Všetky zápasy'))}
  <div class="cols2">
    <div><h3 class="h3">Najbližšie zápasy</h3>${matchList(nextAll, R)}</div>
    <div><h3 class="h3">Posledné výsledky</h3>${matchList(lastAll, R)}</div>
  </div>
</div></section>
${A.table ? `<section class="sec sec--mist" aria-labelledby="liga-h"><div class="wrap">
  ${secHead(esc(A.leagueName), 'liga-h', more(`${R}tabulky/#${A.slug}`, 'Celá tabuľka'))}
  <div class="liga">
    <div>${tableHtml(A.table, R, { compact: true, caption: `<span class="sr">Výrez tabuľky okolo MFK Vrbové</span>` })}</div>
    <div class="liga-side">
      <p class="stat"><span class="stat-n">${A.pos}.</span><span class="stat-l">miesto z ${A.of} po ${aRec.n} zápasoch sezóny ${SEASON}</span></p>
      <div class="liga-row"><h3 class="h4">Forma</h3>${formHtml(A.slug)}</div>
      <p class="liga-rec">${aRec.w} výhier, ${aRec.d} remíz, ${aRec.l} prehier, skóre ${aRec.gf}:${aRec.ga} vo všetkých súťažiach</p>
      ${top.length ? `<div class="liga-row liga-row--list"><h3 class="h4">Strelci</h3><ol class="scorers">${top.map(([n, g]) => `<li><span>${esc(n)}</span><b>${g}</b></li>`).join('')}</ol></div>` : ''}
    </div>
  </div>
</div></section>` : ''}
<section class="sec" aria-labelledby="timy-h"><div class="wrap">
  ${secHead('Tímy', 'timy-h', more(`${R}timy/`, 'Súpisky a zápasy tímov'))}
  ${teamGrid(R)}
</div></section>
${adamecBlock(R, true)}`;
  },
});

function teamGrid(R) {
  return `<ul class="tgrid">${teams.map((t) => `<li class="tcard${t.adult ? ' tcard--adult' : ''}"><a href="${R}${t.url}">
  <span class="tcard-n">${esc(t.short)}</span><span class="tcard-s">${esc(t.adult ? 'Muži' : t.sub)}</span>
  <span class="tcard-l">${esc(t.leagueName)}</span>
  ${t.pos ? `<span class="tcard-p"><b>${t.pos}.</b> miesto z ${t.of}</span>` : ''}
</a></li>`).join('')}</ul>`;
}

// blok o Jozefovi Adamcovi a štadióne (úvod a stránka Štadión)
function adamecBlock(R, teaser = false) {
  const a = club.adamec, z = a.zapas;
  return `<section class="adamec" aria-labelledby="adamec-h"><div class="wrap adamec-in">
  <div class="adamec-copy">
    <h2 class="h2" id="adamec-h">${teaser ? `Hráme na štadióne Jozefa Adamca` : 'Prečo štadión nesie meno Jozefa Adamca'}</h2>
    <p>${esc(a.meno)}, prezývaný ${esc(a.prezyvka)}, sa narodil ${esc(a.narodenie)}. ${esc(a.text[0])}</p>
    ${teaser ? '' : `<p>${esc(a.text[1])}</p>`}
    <p>Pri storočnici klubu v júli 2022 dostal vrbovský štadión jeho meno.</p>
    ${teaser ? `<p><a class="btn btn--yellow" href="${R}stadion/">Štadión a cesta k nemu</a></p>` : `<p class="src">Zdroj: Wikipédia (Jozef Adamec), Piešťanský týždeň, pnky.sk</p>`}
  </div>
  <figure class="mini-board" aria-label="${esc(`${z.domaci} – ${z.hostia} ${z.skore}, ${z.datum}, ${z.miesto}`)}">
    <div class="mb-teams"><span>${esc(z.domaci)}</span><span class="plate">${z.skore.split(':')[0]}</span><span class="colon" aria-hidden="true">:</span><span class="plate">${z.skore.split(':')[1]}</span><span>${esc(z.hostia)}</span></div>
    <figcaption>${esc(z.datum)}, ${esc(z.miesto)}. ${esc(z.pozn)}</figcaption>
  </figure>
</div></section>`;
}

// zápasy
add('zapasy/', {
  title: 'Zápasy a výsledky', active: 'zapasy/', desc: `Program a výsledky všetkých tímov MFK Vrbové v sezóne ${SEASON}.`,
  body: (R) => {
    const grp = (list) => {
      const months = new Map();
      for (const m of list) { const k = monthKey(m.date); if (!months.has(k)) months.set(k, []); months.get(k).push(m); }
      return [...months].map(([k, l]) => `<section class="month" data-month><h3 class="month-h">${monthName(k)}</h3>${matchList(l, R)}</section>`).join('');
    };
    return `${pageHead({ title: 'Zápasy a výsledky', sub: `Sezóna ${SEASON}, všetky tímy. Výsledky, góly a karty preberáme zo Sportnetu.`, R, crumbs: [[null, 'Zápasy']] })}
<section class="sec sec--first"><div class="wrap">
  <div class="filters" data-filters hidden>
    <div class="chips" role="group" aria-label="Tím"><button type="button" class="chip" data-f-team="" aria-pressed="true">Všetky</button>${teams.map((t) => `<button type="button" class="chip" data-f-team="${t.slug}" aria-pressed="false">${esc(t.short)}</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="Miesto"><button type="button" class="chip" data-f-where="" aria-pressed="true">Doma aj vonku</button><button type="button" class="chip" data-f-where="doma" aria-pressed="false">Doma</button><button type="button" class="chip" data-f-where="vonku" aria-pressed="false">Vonku</button></div>
  </div>
  <div class="cols2 cols2--list">
    <section aria-labelledby="z-prog"><h2 class="h2" id="z-prog">Program</h2>${upcoming.length ? grp(upcoming) : '<p>Ďalšie zápasy zatiaľ nie sú vyžrebované.</p>'}<p class="empty" data-empty hidden>Pre tento výber nie je naplánovaný žiadny zápas.</p></section>
    <section aria-labelledby="z-vys"><h2 class="h2" id="z-vys">Výsledky</h2>${grp(results)}<p class="empty" data-empty hidden>Pre tento výber zatiaľ nie je žiadny výsledok.</p></section>
  </div>
  <div class="cal-row">${calBox('vsetky.ics', R, 'cal-vsetky')}</div>
</div></section>`;
  },
});

// detail zápasu
const POS_S = { goalkeeper: 'B', defender: 'O', midfielder: 'S', forward: 'Ú' };
function lineupHtml(l, title) {
  if (!l || (!l.start.length && !l.subs.length)) return '';
  const li = (p) => `<li><span class="ln-nr">${esc(p.nr)}</span><span>${esc(p.name)}${p.c ? ' <abbr class="cap" title="kapitán">C</abbr>' : ''}</span></li>`;
  return `<div class="lineup"><h3 class="h4">${esc(title)}</h3><ol class="ln">${l.start.map(li).join('')}</ol>${l.subs.length ? `<p class="ln-h">Náhradníci</p><ol class="ln ln--subs">${l.subs.map(li).join('')}</ol>` : ''}${l.coach ? `<p class="ln-coach">Tréner: ${esc(l.coach)}</p>` : ''}</div>`;
}
for (const m of matches) {
  if (m.past && !m.detail) continue;
  add(m.url, {
    title: `${m.home ? `${club.nazov} – ${m.opponent}` : `${m.opponent} – ${club.nazov}`}${m.score ? ` ${m.score}` : ''}`, active: 'zapasy/',
    desc: `${m.teamObj.full}, ${m.comp}, ${dLong(m.date)}.`,
    body: (R) => {
      const ev = [...(m.goals || []).map((g) => ({ ...g, t: 'goal' })), ...(m.cards || []).map((c) => ({ ...c, t: 'card' })), ...((m.lineups?.subs) || []).map((s) => ({ ...s, t: 'sub' }))]
        .sort((a, b) => (parseInt(a.min, 10) || 0) - (parseInt(b.min, 10) || 0));
      const evIcon = (e) => e.t === 'goal' ? `<span class="ev-i ev-goal" aria-hidden="true">${I.ball}</span>` : e.t === 'card' ? `<span class="ev-i ev-card ev-card--${e.kind}" aria-hidden="true"></span>` : '<span class="ev-i ev-sub" aria-hidden="true">⇄</span>';
      const evText = (e) => e.t === 'goal' ? `Gól: ${esc(e.player)}${e.kind === 'penalty' ? ' (z penalty)' : e.kind === 'own' ? ' (vlastný)' : ''}` : e.t === 'card' ? `${e.kind === 'yellow' ? 'Žltá karta' : e.kind === 'red' ? 'Červená karta' : 'Druhá žltá a červená'}: ${esc(e.player)}` : `Striedanie: ${esc(e.in)} za ${esc(e.out)}`;
      // strana udalosti na tabuli: domáci vľavo, hostia vpravo
      const evSide = (e) => ((e.side === 'our') === m.home ? 'h' : 'a');
      const prevMeet = matches.filter((x) => x.oppSpace === m.oppSpace && x.id !== m.id && x.team === m.team && x.score);
      return `${pageHead({ title: m.home ? `${club.nazov} – ${m.opponent}` : `${m.opponent} – ${club.nazov}`, sub: `${esc(m.teamObj.full)}, ${esc(m.comp)}${m.roundName ? `, ${esc(m.roundName)}` : ''}`, R, crumbs: [['zapasy/', 'Zápasy'], [null, dShort(m.date) + ' ' + m.opponent]] })}
<section class="sec sec--first"><div class="wrap match">
  <div class="match-board">${board(m, R, { big: true, label: m.score ? 'Konečný výsledok' : 'Zápas' })}</div>
  <div class="match-info">
    ${ev.length ? `<h2 class="h3">Priebeh zápasu</h2><ol class="evs">${ev.map((e) => `<li class="ev ev--${evSide(e)}"><span class="ev-min">${esc(e.min)}′</span>${evIcon(e)}<span>${evText(e)}</span></li>`).join('')}</ol>` : m.score ? '<p>Zápis o stretnutí neobsahuje góly ani karty.</p>' : ''}
    <dl class="facts">
      <div><dt>Dátum</dt><dd>${dLong(m.date)}${m.time ? `, ${esc(m.time)}` : ''}</dd></div>
      ${m.venue ? `<div><dt>Ihrisko</dt><dd>${esc(m.venue.replace(/\s+/g, ' '))}</dd></div>` : ''}
      ${m.referee ? `<div><dt>Rozhodca</dt><dd>${esc(m.referee)}</dd></div>` : ''}
    </dl>
    <p class="btns">${m.url ? '' : ''}${m.score && sn.matches.find((x) => x.id === m.id)?.url ? `<a class="btn btn--line" href="${sn.matches.find((x) => x.id === m.id).url}" rel="noopener">${I.ext}Zápis na Sportnete</a>` : ''}${!m.past ? `<a class="btn btn--blue" href="${R}kalendar/zapas-${m.id}.ics" download>${I.cal}Pridať do kalendára</a>${m.home ? `<a class="btn btn--line" href="${mapsUrl}" rel="noopener">${I.route}Navigovať na štadión</a>` : ''}` : ''}</p>
  </div>
  ${m.lineups ? `<div class="lineups"><h2 class="h3 lineups-h">Zostavy</h2>${lineupHtml(m.home ? m.lineups.our : m.lineups.opp, m.home ? club.nazov : m.opponent)}${lineupHtml(m.home ? m.lineups.opp : m.lineups.our, m.home ? m.opponent : club.nazov)}</div>` : ''}
  ${prevMeet.length ? `<div class="meet"><h2 class="h3">Ďalšie zápasy s týmto súperom v sezóne</h2>${matchList(prevMeet, R, { showTeam: false })}</div>` : ''}
</div></section>`;
    },
  });
}

// tabuľky
add('tabulky/', {
  title: 'Tabuľky', active: 'tabulky/', desc: `Tabuľky súťaží, v ktorých hrajú tímy MFK Vrbové v sezóne ${SEASON}.`,
  body: (R) => `${pageHead({ title: 'Tabuľky', sub: `Sezóna ${SEASON}. Poradie podľa Sportnetu, náš tím je zvýraznený.`, R, crumbs: [[null, 'Tabuľky']] })}
<section class="sec sec--first"><div class="wrap">
  <nav class="toc" aria-label="Tabuľky tímov">${teams.filter((t) => t.table).map((t) => `<a href="#${t.slug}">${esc(t.short)}</a>`).join('')}</nav>
  ${teams.filter((t) => t.table).map((t) => `<section class="tsec" id="${t.slug}" aria-labelledby="h-${t.slug}">
    <div class="sec-head"><h2 class="h2" id="h-${t.slug}">${esc(t.full)}</h2>${more(`${R}${t.url}`, 'Stránka tímu')}</div>
    <p class="tsec-l">${esc(t.leagueName)}</p>
    ${tableHtml(t.table, R)}
  </section>`).join('')}
</div></section>`,
});

// tímy
add('timy/', {
  title: 'Tímy', active: 'timy/', desc: `Všetky tímy MFK Vrbové: muži a mládež, súťaže a umiestnenie v sezóne ${SEASON}.`,
  body: (R) => `${pageHead({ title: 'Tímy', sub: `${teams.length} tímov v sezóne ${SEASON}, od prípravky po A-mužstvo.`, R, crumbs: [[null, 'Tímy']] })}
<section class="sec sec--first"><div class="wrap">${teamGrid(R)}</div></section>`,
});

for (const t of teams) {
  add(t.url, {
    title: t.full, active: 'timy/', desc: `${club.nazov} – ${t.full}: ${t.leagueName}, zápasy, tabuľka a súpiska v sezóne ${SEASON}.`,
    body: (R) => {
      const list = teamMatches(t.slug);
      const nx = list.filter((m) => !m.past), rs = list.filter((m) => m.past).reverse();
      const pick = boardPick(t.slug);
      const rec = record(t.slug);
      const sc = scorers(t.slug);
      const groups = POS.map(([k, h]) => [h, t.squad.athletes.filter((a) => (k ? a.pos === k : !POS.some(([x]) => x && x === a.pos)))]).filter(([, l]) => l.length);
      const nrCount = new Map(); for (const a of t.squad.athletes) nrCount.set(a.nr, (nrCount.get(a.nr) || 0) + 1);
      const nr = (a) => (a.nr !== '' && nrCount.get(a.nr) === 1 ? a.nr : '');
      return `${pageHead({ title: t.full, sub: `${esc(t.leagueName)}${t.pos ? `, <b>${t.pos}. miesto</b> z ${t.of}` : ''}`, R, crumbs: [['timy/', 'Tímy'], [null, t.short]] })}
<section class="sec sec--first"><div class="wrap team-top">
  ${pick ? `<div>${board(pick, R, { big: true })}</div>` : ''}
  <div class="team-side">
    ${rec.n ? `<p class="stat"><span class="stat-n">${rec.w}–${rec.d}–${rec.l}</span><span class="stat-l">výhry, remízy a prehry, skóre ${rec.gf}:${rec.ga}</span></p><div class="liga-row"><h2 class="h4">Forma</h2>${formHtml(t.slug)}</div>` : '<p>Výsledky prípraviek sa nezapisujú, rozpis zápasov je nižšie.</p>'}
    ${sc.length && t.adult ? `<div class="liga-row liga-row--list"><h2 class="h4">Strelci v sezóne</h2><ol class="scorers">${sc.slice(0, 5).map(([n, g]) => `<li><span>${esc(n)}</span><b>${g}</b></li>`).join('')}</ol></div>` : ''}
    ${calBox(`${t.slug}.ics`, R, `cal-${t.slug}`)}
  </div>
</div></section>
<section class="sec" aria-labelledby="tz-h"><div class="wrap">
  ${secHead('Zápasy', 'tz-h')}
  <div class="cols2">
    <div><h3 class="h3">Program</h3>${nx.length ? matchList(nx, R, { showTeam: false }) : '<p>Ďalšie zápasy zatiaľ nie sú vyžrebované.</p>'}</div>
    <div><h3 class="h3">Výsledky</h3>${rs.length ? matchList(rs, R, { showTeam: false }) : '<p>Tím v tejto sezóne ešte nehral.</p>'}</div>
  </div>
</div></section>
${t.table ? `<section class="sec sec--mist" aria-labelledby="tt-h"><div class="wrap">${secHead('Tabuľka', 'tt-h')}<p class="tsec-l">${esc(t.leagueName)}</p>${tableHtml(t.table, R)}</div></section>` : ''}
<section class="sec" aria-labelledby="ts-h"><div class="wrap">
  ${secHead('Súpiska', 'ts-h')}
  <p class="note">Hráči, ktorí v kalendárnom roku ${sn.updated.slice(0, 4)} nastúpili alebo boli v nominácii na zápas (podľa Sportnetu).${t.adult ? '' : ' Pri mládeži uvádzame len mená.'}</p>
  ${groups.map(([h, l]) => `<h3 class="h4 sq-h">${h}</h3><ul class="squad">${l.sort((a, b) => a.name.split(' ').at(-1).localeCompare(b.name.split(' ').at(-1), 'sk')).map((a) => `<li class="pl"><span class="pl-nr" aria-hidden="true">${esc(nr(a)) || '<span class="pl-dot"></span>'}</span><span class="pl-name">${esc(a.name)}${a.captain && t.adult ? ' <abbr class="cap" title="kapitán">C</abbr>' : ''}</span>${nr(a) ? `<span class="sr">, číslo ${nr(a)}</span>` : ''}</li>`).join('')}</ul>`).join('')}
  ${t.squad.crew.length ? `<h3 class="h4 sq-h">Realizačný tím</h3><ul class="crew">${t.squad.crew.map((c) => `<li><span class="crew-r">${esc(crewRole[c.role] || crewRole.other)}</span><span>${esc(c.name)}</span></li>`).join('')}</ul>` : ''}
</div></section>`;
    },
  });
}

// klub
add('klub/', {
  title: 'O klube', active: 'klub/', desc: `${club.pravnyNazov}: história od roku ${club.zalozenie}, storočnica a Jozef Adamec.`,
  body: (R) => `${pageHead({ title: 'O klube', sub: `${esc(club.pravnyNazov)}, futbal vo Vrbovom od roku ${club.zalozenie}.`, R, crumbs: [[null, 'Klub']] })}
<section class="sec sec--first"><div class="wrap prose-grid">
  <div class="prose">
    <h2 class="h2">História</h2>
    <ol class="timeline">${club.historia.map((h) => `<li${h.rok ? '' : ' class="tl-norok"'}>${h.rok ? `<span class="tl-y">${esc(h.rok)}</span>` : ''}<p>${esc(h.text)}</p></li>`).join('')}</ol>
    <p class="src">Zdroje: ${[...new Set(club.historia.flatMap((h) => h.zdroj.split('; ')))].map(esc).join(', ')}. Podrobnú históriu klubu doplní klub.</p>
  </div>
  <aside class="klub-aside">
    <img src="${R}img/erb-480.webp" alt="Erb MFK Vrbové" width="240" height="309" loading="lazy">
    <h2 class="h4">Dnes</h2>
    <ul class="plain">${teams.map((t) => `<li><a href="${R}${t.url}">${esc(t.full)}</a>, ${esc(t.leagueName)}</li>`).join('')}</ul>
  </aside>
</div></section>
${adamecBlock(R)}`,
});

// štadión
add('stadion/', {
  title: club.stadion.nazov, active: 'stadion/', desc: `${club.stadion.nazov}, ${club.stadion.adresa.join(', ')}. Kapacita, rozmery ihriska a navigácia.`,
  body: (R) => {
    const home = upcoming.filter((m) => m.home).slice(0, 5);
    return `${pageHead({ title: 'Štadión Jozefa Adamca', sub: `${esc(club.stadion.nazov)}, ${club.stadion.adresa.map(esc).join(', ')}`, R, crumbs: [[null, 'Štadión']] })}
<section class="sec sec--first"><div class="wrap stad">
  <dl class="facts facts--big">
    <div><dt>Kapacita</dt><dd>${club.stadion.kapacita.toLocaleString('sk-SK')} divákov</dd></div>
    <div><dt>Ihrisko</dt><dd>${esc(club.stadion.rozmery)}</dd></div>
    <div><dt>Adresa</dt><dd>${club.stadion.adresa.map(esc).join(', ')}</dd></div>
  </dl>
  <p class="btns"><a class="btn btn--blue" href="${mapsUrl}" rel="noopener">${I.route}Navigovať (Google Mapy)</a><a class="btn btn--line" href="${mapyUrl}" rel="noopener">${I.pin}Mapy.com</a></p>
  <p class="src">Údaje o ihrisku: Sportnet.</p>
  ${home.length ? `<h2 class="h3">Najbližšie zápasy doma</h2>${matchList(home, R)}` : ''}
</div></section>
${adamecBlock(R)}`;
  },
});

// kontakt
add('kontakt/', {
  title: 'Kontakt', active: 'kontakt/', desc: `Kontakt na ${club.nazov}: ${club.kontakt.osoba}, telefón, e-mail, adresa a fakturačné údaje.`,
  body: (R) => `${pageHead({ title: 'Kontakt', sub: 'Zápisy do mládeže, zápasy, spolupráca a partnerstvo.', R, crumbs: [[null, 'Kontakt']] })}
<section class="sec sec--first"><div class="wrap contact">
  <div class="ccard">
    <h2 class="h3">Kontaktná osoba klubu</h2>
    <p class="ccard-n">${esc(club.kontakt.osoba)}</p>
    <p class="btns"><a class="btn btn--blue" href="${tel(club.kontakt.telefon)}">${I.phone}${esc(club.kontakt.telefon)}</a><a class="btn btn--line" href="mailto:${club.kontakt.email}">${I.mail}<span>${esc(club.kontakt.email).replace('@', '<wbr>@')}</span></a></p>
    <p><a class="lnk" href="${club.facebook}" rel="noopener">${I.fb}Facebook MFK Vrbové</a></p>
  </div>
  <dl class="facts">
    <div><dt>Názov</dt><dd>${esc(club.pravnyNazov)}</dd></div>
    <div><dt>Sídlo</dt><dd>${club.adresa.map(esc).join(', ')}</dd></div>
    <div><dt>IČO</dt><dd>${esc(club.ico)}</dd></div>
    <div><dt>Bankový účet</dt><dd class="nw">${esc(club.ucet)}</dd></div>
  </dl>
  <div>
    <h2 class="h3">Dokumenty</h2>
    <ul class="docs">${club.dokumenty.map((d) => `<li><a href="${d.url}" rel="noopener">${I.doc}<span>${esc(d.nazov)}</span><small>${esc(d.typ)}, ${esc(d.zdroj)}</small></a></li>`).join('')}</ul>
    <p class="src">Kontakt a fakturačné údaje: Sportnet. Tréneri a vedúci tímov sú na stránkach <a href="${R}timy/">tímov</a>.</p>
  </div>
</div></section>`,
});

add('ochrana-sukromia/', {
  title: 'Ochrana súkromia', desc: 'Ako web MFK Vrbové pracuje s údajmi.',
  body: (R) => `${pageHead({ title: 'Ochrana súkromia', R, crumbs: [[null, 'Ochrana súkromia']] })}
<section class="sec sec--first"><div class="wrap prose">
  <p>Web nepoužíva cookies, analytiku ani reklamné nástroje a nenačítava nič z iných serverov. Všetky súbory vrátane písma a erbov sú uložené priamo na webe.</p>
  <p>Mená hráčov, trénerov a rozhodcov, výsledky, strelcov a karty preberáme z verejného systému Sportnet (Futbalnet), kam ich zapisujú kluby a zväzy pri zápasoch. Vek hráčov nezverejňujeme, pri mládeži uvádzame len mená a zostavy zápasov len pri dospelých.</p>
  <p>Ak chcete niečo opraviť alebo odstrániť, napíšte na <a href="mailto:${club.kontakt.email}">${esc(club.kontakt.email)}</a>.</p>
</div></section>`,
});

add('404/', {
  title: 'Stránka sa nenašla',
  body: (R) => `${pageHead({ title: 'Stránka sa nenašla', sub: 'Adresa je chybná alebo sa stránka presunula.', R })}
<section class="sec sec--first"><div class="wrap"><p class="btns"><a class="btn btn--blue" href="${R}">Na úvod</a><a class="btn btn--line" href="${R}zapasy/">Zápasy a výsledky</a></p></div></section>`,
});

// ---- kalendár (.ics, RFC 5545) ----------------------------------------------------------------
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFold = (line) => {
  const out = []; let cur = '';
  for (const ch of line) { if (Buffer.byteLength(cur + ch) > 74) { out.push(cur); cur = ' ' + ch; } else cur += ch; }
  out.push(cur);
  return out.join('\r\n');
};
const VTZ = ['BEGIN:VTIMEZONE', 'TZID:Europe/Bratislava',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE'];
function ics(list, calName) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const events = list.map((m) => {
    const us = m.teamObj.adult ? club.nazov : `${club.nazov} ${m.teamObj.short}`;
    const [h, a] = m.home ? [us, m.opponent] : [m.opponent, us];
    const d = m.date.replace(/-/g, '');
    const t = (m.time || '').slice(0, 5);
    const when = t ? [`DTSTART;TZID=Europe/Bratislava:${d}T${t.replace(':', '')}00`, 'DURATION:PT2H'] : [`DTSTART;VALUE=DATE:${d}`];
    const desc = [m.comp + (m.roundName ? `, ${m.roundName}` : ''), m.home ? 'Domáci zápas' : 'Zápas vonku'].join('\n');
    return ['BEGIN:VEVENT', `UID:zapas-${m.id}@${config.sportnet.club}.sportnet`, `DTSTAMP:${stamp}`, ...when,
      `SUMMARY:${icsEsc(`${m.teamObj.short}: ${h} – ${a}${m.score ? ` ${m.score}` : ''}`)}`,
      `DESCRIPTION:${icsEsc(desc)}`, m.venue && `LOCATION:${icsEsc(m.venue.replace(/\s+/g, ' '))}`, 'END:VEVENT'].filter(Boolean);
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${club.nazov}//Zapasy//SK`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEsc(calName)}`, 'X-WR-TIMEZONE:Europe/Bratislava', ...VTZ, ...events.flat(), 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n';
}

// ---- ukážka administrácie (dist/admin/demo.json pre src/admin/admin.js) ------------------------------
function writeAdminDemo() {
  // rovnaký tvar dát ako administrácia OK Častkovce (src/admin/admin.js je spoločný základ)
  const R = '../';
  const snById = Object.fromEntries(sn.matches.map((m) => [m.id, m]));
  const people = (t) => t.squad.athletes.map((a) => ({ name: a.name, number: a.nr === '' ? '' : String(a.nr), role: '', photo: null }));
  const demo = {
    club: { nazov: club.nazov, crest: `${R}img/erb-128.webp` },
    updated: sn.updated, season: sn.season,
    teams: teams.map((t) => ({ slug: t.slug, short: t.short, sub: t.adult ? 'Muži' : t.sub })),
    matches: matches.map((m) => ({
      id: m.id, team: m.team, date: m.date, time: m.time, home: m.home, opponent: m.opponent, competition: m.comp, part: '',
      round: (/\d+/.exec(m.round) || [''])[0], played: m.past, score: m.score, goals: m.goals || [], cards: m.cards || [],
      venue: (m.venue || '').replace(/\s+/g, ' '), url: snById[m.id]?.url || null, gallery: null, video: null,
    })),
    rosters: Object.fromEntries(teams.map((t) => [t.slug, people(t).map(({ name, number, photo }) => ({ name, number, photo }))])),
    news: [],
    info: {
      nazov: club.nazov, pravnyNazov: club.pravnyNazov, adresa: club.adresa, osoba: club.kontakt.osoba, telefon: club.kontakt.telefon, email: club.kontakt.email,
      facebook: club.facebook, ico: club.ico, ucet: club.ucet, stadion: { nazov: club.stadion.nazov, kapacita: String(club.stadion.kapacita), rozmery: club.stadion.rozmery, vip: String(club.stadion.vip) },
    },
    allTeams: teams.map((t) => ({
      slug: t.slug, short: t.short, sub: t.adult ? 'Muži' : t.sub, league: t.leagueName, url: t.url, photo: null,
      groups: [{ title: 'Hráči', people: people(t) }, { title: 'Realizačný tím', people: t.squad.crew.map((c) => ({ name: c.name, number: '', role: crewRole[c.role] || crewRole.other, photo: null })) }],
    })),
    coaches: [],
    pages: {
      historia: { title: 'História', url: 'klub/', html: `<ul>${club.historia.map((h) => `<li>${h.rok ? `<b>${esc(h.rok)}</b> – ` : ''}${esc(h.text)}</li>`).join('')}</ul>` },
      adamec: { title: 'Jozef Adamec (štadión)', url: 'stadion/', html: club.adamec.text.map((t) => `<p>${esc(t)}</p>`).join('') },
      'ochrana-sukromia': { title: 'Ochrana súkromia', url: 'ochrana-sukromia/', html: '<p>Web nepoužíva cookies, analytiku ani reklamné nástroje.</p>' },
    },
    home: {
      heroTitle: `Futbal vo Vrbovom od roku ${club.zalozenie}`, heroText: `${club.pravnyNazov}. Muži hrajú ${acc(A.leagueName)}, v klube je ${teams.length} tímov od prípravky po áčko.`, hero: null,
      stadion: { title: 'Hráme na štadióne Jozefa Adamca', text: `${club.adamec.meno}, prezývaný ${club.adamec.prezyvka}, sa narodil ${club.adamec.narodenie}. ${club.adamec.text[0]}` },
    },
    galleries: [], videos: [], fanshop: { pozn: '', email: club.kontakt.email, produkty: [] }, partners: [],
  };
  fs.writeFileSync(path.join(OUT, 'admin', 'demo.json'), JSON.stringify(demo));
}

// ---- zápis -------------------------------------------------------------------------------------
// obsah dist/ sa maže po súboroch: koreň môže držať náhľadový server (fs.watch) alebo otvorený terminál
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
const copy = (from, to) => { if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true }); };
copy(path.join(SRC, 'img'), path.join(OUT, 'img'));
copy(path.join(SRC, 'fonts'), path.join(OUT, 'fonts'));
copy(path.join(SRC, 'js'), path.join(OUT, 'js'));
copy(path.join(ROOT, 'media', 'foto-web'), path.join(OUT, 'foto'));
if (config.adminDemo !== false && fs.existsSync(path.join(SRC, 'admin', 'index.html'))) { copy(path.join(SRC, 'admin'), path.join(OUT, 'admin')); writeAdminDemo(); }
fs.rmSync(path.join(OUT, 'fonts', 'fonts.css'), { force: true });
fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
const fontsCss = fs.readFileSync(path.join(SRC, 'fonts', 'fonts.css'), 'utf8').replace(/url\(([^)]+)\)/g, 'url(../fonts/$1)');
fs.writeFileSync(path.join(OUT, 'css', 'site.css'), fontsCss + fs.readFileSync(path.join(SRC, 'css', 'site.css'), 'utf8'));

for (const p of pages) {
  const depth = p.route.split('/').filter(Boolean).length;
  const R = depth ? '../'.repeat(depth) : './';
  const html = layout({ ...p, body: p.body(R) });
  const file = path.join(OUT, p.route, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
// GitHub Pages: 404 v koreni (absolútne cesty, lebo sa zobrazuje na ľubovoľnej adrese)
const BASE = process.env.BASE_PATH || config.basePath || '/';
const notFound = fs.readFileSync(path.join(OUT, '404', 'index.html'), 'utf8').replace(/(href|src|data-root)="(\.\.\/)+/g, `$1="${BASE}`);
fs.writeFileSync(path.join(OUT, '404.html'), notFound);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, '.gitattributes'), '*.ics -text\n'); // RFC 5545 chce CRLF, git na Windowse by ho zmenil

// kalendáre .ics: každý tím, všetky zápasy a jednotlivé budúce zápasy
fs.mkdirSync(path.join(OUT, 'kalendar'), { recursive: true });
for (const t of teams) fs.writeFileSync(path.join(OUT, 'kalendar', `${t.slug}.ics`), ics(teamMatches(t.slug), `${club.nazov} – ${t.full}`));
fs.writeFileSync(path.join(OUT, 'kalendar', 'vsetky.ics'), ics(matches, `${club.nazov} – všetky zápasy`));
for (const m of upcoming) fs.writeFileSync(path.join(OUT, 'kalendar', `zapas-${m.id}.ics`), ics([m], `${club.nazov} – ${m.teamObj.full}`));
console.log(`Hotovo: ${pages.length} stránok -> dist/ (dnes = ${TODAY})`);
