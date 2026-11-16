# Jednorazový prenos administrácie z projektu ok-castkovce (spoločný základ). Spúšťať len pri preberaní noviniek z Častkoviec.
# Prenesie administráciu z ok-castkovce do mfk-vrbove: rovnaké funkcie, názov a erb z demo.json, farby MFK, bez Fanzóny.
import re, shutil, sys
from pathlib import Path

SRC = Path(r'C:\Users\lenic\ok-castkovce\src\admin')
DST = Path(r'C:\Users\lenic\mfk-vrbove\src\admin')
DST.mkdir(parents=True, exist_ok=True)
js = (SRC / 'admin.js').read_text(encoding='utf8')
css = (SRC / 'admin.css').read_text(encoding='utf8')
html = (SRC / 'index.html').read_text(encoding='utf8')

def rep(s, old, new, count=1, name=''):
    n = s.count(old)
    if n < 1 or (count and n != count):
        sys.exit(f'CHYBA: "{name or old[:60]}" nájdené {n}×, čakal som {count}')
    return s.replace(old, new)

# ---- admin.js ----
js = rep(js, "// Administrácia OK Častkovce – klikateľná ukážka.", "// Administrácia klubového webu (MFK Vrbové) – klikateľná ukážka.")
js = rep(js, "const KEY = 'okc-admin-demo-v2';", "const KEY = 'mfk-vrbove-admin-demo-v1';")
js = rep(js, '<img src="../img/logo.svg" alt=""><b>OK Častkovce</b>', '<img src="${esc(D.club.crest)}" alt=""><b>${esc(D.club.nazov)}</b>')
js = rep(js, '<img class="login-crest" src="../img/logo.svg" alt="">', '<img class="login-crest" src="${esc(D.club.crest)}" alt="">')
js = rep(js, '<p class="lead">OK Častkovce · prihlásenie pre správcov, trénerov a fotografa</p>', '<p class="lead">${esc(D.club.nazov)} · prihlásenie pre správcov, trénerov a fotografa</p>')
js = rep(js, 'placeholder="meno@okcastkovce.sk"', 'placeholder="meno@klub.sk"')
js = rep(js, "|| 'spravca@okcastkovce.sk'", "|| 'spravca@klub.sk'")
js = rep(js, "automaticky každú hodinu", "automaticky po každom zápase")
js = rep(js, "['OK Častkovce', m.opponent] : [m.opponent, 'OK Častkovce']", "[D.club.nazov, m.opponent] : [m.opponent, D.club.nazov]")
js = rep(js, 'placeholder="Napr. U15: OK Častkovce vs. FK Beluša"', 'placeholder="Napr. U15: ${esc(D.club.nazov)} – súper"')
js = rep(js, 'placeholder="Napr. OK Častkovce – FK Beluša (zostrih)"', 'placeholder="Napr. ${esc(D.club.nazov)} – súper (zostrih)"')
js = rep(js, 'placeholder="Napr. Šál OK Častkovce"', 'placeholder="Napr. Šál klubu"')
js = rep(js, "email: 'spravca@okcastkovce.sk'", "email: 'spravca@klub.sk'")
js = rep(js, "· Administrácia OK Častkovce`", "· Administrácia ${D.club.nazov}`")
js = rep(js, "'text zo starého webu'", "'pôvodný text'")
# menu: bez Fanzóny (klub nemá e-shop) a bez samostatných trénerov (realizačný tím je pri tíme)
js = rep(js, "['#/ludia', 'Tréneri a vedenie', 'people', 'ludia'], ", "")
js = rep(js, "['#/fanzona', 'Fanzóna', 'bag', 'fanzona'], ", "", name='GROUPS fanzona')
js = rep(js, ", ['#/fanzona', 'Fanzóna', 'bag', 'fanzona']].filter", "].filter", name='shortcuts fanzona')
js = rep(js, "vy upravujete všetok obsah webu: texty, fotky, ľudí, produkty a partnerov.", "vy upravujete všetok obsah webu: správy, fotky, súpisky, texty, kontakty a partnerov.")
# profily hráčov na webe zatiaľ nie sú
js = re.sub(r"\n    \$\{g\.title === 'Hráči' && g\.people\.length \? `<p class=\"help\">Profil hráča.*?: ''\}", '', js, count=1)

# kontakty a údaje: polia podľa data/klub.json MFK
start = js.index('const INFO_F = [')
end = js.index('// ---- úvodná stránka ----')
js = js[:start] + r"""const INFO_F = [
  ['Klub', [['nazov', 'Názov klubu'], ['pravnyNazov', 'Právny názov'], ['adresa', 'Sídlo (každý riadok zvlášť)', 'lines']]],
  ['Kontakt', [['osoba', 'Kontaktná osoba'], ['telefon', 'Telefón', 'tel'], ['email', 'E-mail', 'email'], ['facebook', 'Facebook (odkaz)', 'url']]],
  ['Fakturačné údaje', [['ico', 'IČO'], ['ucet', 'Číslo účtu (IBAN)']]],
];
const STAD_F = [['nazov', 'Názov štadióna'], ['kapacita', 'Kapacita (divákov)'], ['rozmery', 'Rozmery ihriska'], ['vip', 'Miesta VIP']];
function vContacts() {
  const i = get('info', D.info);
  const fld = (k, l, t) => t === 'lines' ? `<label class="field"><span>${l}</span><textarea class="textarea textarea--s" name="${k}" rows="3">${esc((i[k] || []).join('\n'))}</textarea></label>` : `<label class="field"><span>${l}</span><input class="input" name="${k}" ${t ? `type="${t}"` : ''} value="${esc(i[k] || '')}"></label>`;
  return shell('kontakty', `${head('Kontakty a údaje', 'Zobrazujú sa v pätičke každej stránky, v Kontakte a na stránke Štadión.')}
  <form id="kf" novalidate>${INFO_F.map(([g, fs]) => `<section class="card"><div class="card-h"><h2>${g}</h2></div>${fs.map(([k, l, t]) => fld(k, l, t)).join('')}</section>`).join('')}
  <section class="card"><div class="card-h"><h2>Štadión</h2></div><div class="grid2 grid2--tight">${STAD_F.map(([k, l]) => `<label class="field"><span>${l}</span><input class="input" name="st_${k}" value="${esc(i.stadion?.[k] ?? '')}"></label>`).join('')}</div></section>
  ${savebar('<b>Údaje klubu</b>', '<button class="btn btn--sm" type="submit">Uložiť</button>')}</form>`);
}
function bindContacts() {
  const f = document.getElementById('kf'); if (!f) return;
  f.addEventListener('input', dirtyState);
  f.onsubmit = (ev) => {
    ev.preventDefault();
    const i = get('info', D.info);
    for (const [, fs] of INFO_F) for (const [k, , t] of fs) i[k] = t === 'lines' ? f[k].value.split('\n').map((s) => s.trim()).filter(Boolean) : f[k].value.trim();
    if (!validMail(i.email)) { f.email.focus(); return toast('E-mail nie je platný'); }
    if (!validUrl(i.facebook)) return toast('Odkaz na Facebook musí začínať https://');
    i.stadion = { ...(i.stadion || {}), ...Object.fromEntries(STAD_F.map(([k]) => [k, f['st_' + k].value.trim()])) };
    put('info', i, 'Kontakty a údaje klubu upravené', 'kontakt/'); route(); toast('Údaje uložené (ukážka)');
  };
}

""" + js[end:]

# úvodná stránka: nadpis, text a blok o štadióne (MFK zatiaľ nemá fotky)
start = js.index('// ---- úvodná stránka ----')
end = js.index('// ---- fanzóna ----')
js = js[:start] + r"""// ---- úvodná stránka ----
function vHomeEdit() {
  const h = get('home', D.home);
  return shell('uvod', `${head('Úvodná stránka', `Nadpis, text a hlavná fotka. Tabuľa so zápasmi, program, tabuľka a tímy sa skladajú samé. ${webLink('')}`)}
  <form id="hf" novalidate>
  <section class="card"><div class="card-h"><h2>Úvod</h2></div>
    <label class="field"><span>Nadpis</span><input class="input" name="heroTitle" value="${esc(h.heroTitle)}"></label>
    <label class="field"><span>Text pod nadpisom</span><textarea class="textarea textarea--s" name="heroText" rows="3">${esc(h.heroText)}</textarea></label>
    <p class="label mt">Hlavná fotka</p><div id="hhero">${h.hero ? `<img class="cover" src="${esc(h.hero)}" alt="Hlavná fotka úvodu">` : '<p class="help">Zatiaľ bez fotky – úvod je žltá plocha z erbu. Po nahratí sa fotka ukáže vedľa tabule.</p>'}</div>
    <label class="drop drop--s">${ic('camera')}<b>${h.hero ? 'Vymeniť fotku' : 'Nahrať fotku'}</b><input type="file" id="hfile" accept="image/*"></label></section>
  <section class="card"><div class="card-h"><h2>Blok o štadióne</h2></div>
    <label class="field"><span>Nadpis</span><input class="input" name="st_title" value="${esc(h.stadion.title)}"></label>
    <label class="field"><span>Text</span><textarea class="textarea textarea--s" name="st_text" rows="4">${esc(h.stadion.text)}</textarea><small>Adresa a kapacita sa berú z Kontaktov a údajov.</small></label></section>
  ${savebar('<b>Úvodná stránka</b>', '<button class="btn btn--sm" type="submit">Uložiť</button>')}</form>`);
}
function bindHomeEdit() {
  const f = document.getElementById('hf'); if (!f) return;
  const h = get('home', D.home);
  f.addEventListener('input', dirtyState);
  document.getElementById('hfile').addEventListener('change', async (e) => { const x = e.target.files[0]; if (x) { h.hero = await thumb(x, 1200).catch(() => h.hero); document.getElementById('hhero').innerHTML = `<img class="cover" src="${esc(h.hero)}" alt="">`; dirtyState(); } });
  f.onsubmit = (ev) => {
    ev.preventDefault();
    Object.assign(h, { heroTitle: f.heroTitle.value.trim(), heroText: f.heroText.value.trim() });
    Object.assign(h.stadion, { title: f.st_title.value.trim(), text: f.st_text.value.trim() });
    put('home', h, 'Úvodná stránka upravená', ''); route(); toast('Úvod uložený (ukážka)');
  };
}

""" + js[end:]
# profily hráčov: vek ani bydlisko detí sa nezverejňujú
js = re.sub(r"const PF = \[.*?\];", "const PF = [['volnyCas', 'Voľný čas, záľuby', 'text'], ['klub', 'Obľúbený klub', 'text']]; // bez dátumu narodenia a bydliska (deti)", js, count=1)
(DST / 'admin.js').write_text(js, encoding='utf8')

# ---- admin.css: písmo a farby MFK ----
css = rep(css, '/* Administrácia OK Častkovce (ukážka)', '/* Administrácia MFK Vrbové (ukážka)')
css = re.sub(r"@font-face \{ font-family: 'Barlow'.*?\n(?=\n:root)", """@font-face { font-family: 'Schibsted Grotesk'; font-weight: 400; font-display: swap; src: url(../fonts/schibsted-grotesk-400.woff) format('woff'); }
@font-face { font-family: 'Schibsted Grotesk'; font-weight: 500; font-display: swap; src: url(../fonts/schibsted-grotesk-500.woff) format('woff'); }
@font-face { font-family: 'Schibsted Grotesk'; font-weight: 700; font-display: swap; src: url(../fonts/schibsted-grotesk-700.woff) format('woff'); }
@font-face { font-family: 'Big Shoulders Display'; font-weight: 800; font-display: swap; src: url(../fonts/big-shoulders-display-800.woff) format('woff'); }
""", css, count=1, flags=re.S)
css = rep(css, "--ink: #121317; --ink-2: #2b2e36; --muted: #5b5e66; --muted-2: #8a8d94;", "--ink: #0e1f4d; --ink-2: #1b3a87; --muted: #535d77; --muted-2: #7f88a0;")
css = rep(css, "--bg: #f4f3ef; --card: #fff; --line: #e2dfd8; --line-2: #ece9e3; --tint: #f7f6f2;", "--bg: #eef1f7; --card: #fff; --line: #d6dbe7; --line-2: #e3e7f0; --tint: #f5f7fb;")
css = rep(css, "--red: #d2231a; --red-d: #a8190f; --red-bg: #fdecea;", "--red: #1b3a87; --red-d: #142e70; --red-bg: #e7ecf8;")
css = rep(css, "--yellow-card: #f2c200; --red-card: #d2231a;", "--yellow-card: #f6c400; --red-card: #bf2f27;")
css = rep(css, "--f: 'Barlow', system-ui", "--f: 'Schibsted Grotesk', system-ui")
css = rep(css, "--f-d: 'Barlow Condensed', 'Barlow', 'Arial Narrow', sans-serif;", "--f-d: 'Big Shoulders Display', 'Arial Narrow', sans-serif;")
css = css.replace('#f5cb00', '#f6c400')
# italika Barlow Condensed 800i nie je, Big Shoulders sa píše rovno
css = css.replace('font-style: italic;', 'font-style: normal;').replace('font: italic ', 'font: ')
(DST / 'admin.css').write_text(css, encoding='utf8')

# ---- index.html ----
html = rep(html, 'Administrácia · OK Častkovce (ukážka)', 'Administrácia · MFK Vrbové (ukážka)')
html = rep(html, '<meta name="theme-color" content="#121317">', '<meta name="theme-color" content="#0e1f4d">')
html = rep(html, '<link rel="preload" href="../fonts/barlow-400.woff" as="font" type="font/woff" crossorigin>', '<link rel="preload" href="../fonts/schibsted-grotesk-400.woff" as="font" type="font/woff" crossorigin>')
(DST / 'index.html').write_text(html, encoding='utf8')
print('admin prenesený:', len(js), 'B js,', len(css), 'B css')
