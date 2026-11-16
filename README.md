# MFK Vrbové – návrh webu

Návrh webu futbalového klubu MFK Vrbové (Mestský futbalový klub Vrbové). **Nie je to oficiálna stránka klubu.** Ukážka má v hlavičke pás s týmto upozornením a vyhľadávače ju neindexujú (`noindex`).

Ukážka: https://matuslenicky.github.io/mfk-vrbove/ · administrácia (ukážka bez ukladania): https://matuslenicky.github.io/mfk-vrbove/admin/

## Obsah a zdroje

- Zápasy, výsledky, strelci, karty, zostavy dospelých, tabuľky a súpisky zo Sportnetu (Futbalnet), verejné API súťaží (`scripts/sportnet.mjs` → `data/sportnet.json`). Vek hráčov sa neukladá, zostavy len pri dospelých.
- Údaje o klube v `data/klub.json`, každá časť s uvedeným zdrojom: kontakt a fakturačné údaje zo Sportnetu, štadión zo zápisu o stretnutí, história z Wikipédie a článkov Piešťanského týždňa a pnky.sk k storočnici (2022), stanovy z webu mesta Vrbové.
- Erb MFK Vrbové a erby súperov zo Sportnetu (`scripts/logos.py`). Patria príslušným klubom.
- Písmo Big Shoulders Display a Schibsted Grotesk, licencia SIL Open Font License 1.1.

## Zostavenie

Statický generátor bez závislostí (Node 20+, Python 3 s Pillow na erby):

```
node scripts/sportnet.mjs        # zápasy, tabuľky a súpisky (FULL=1 stiahne znova aj detaily zápasov)
python -I scripts/logos.py       # erby súperov a náš erb do src/img
node build.js                    # data/ + src/ -> dist/ (TODAY=2026-11-16 prepíše dnešný dátum)
node scripts/serve.mjs dist 5270 # náhľad na http://127.0.0.1:5270/
node scripts/deploy.mjs          # nasadenie dist/ na vetvu gh-pages (GitHub Pages)
```

`config.json`: `sportnet.appSpace` určuje klub (web sa dá postaviť pre iný klub zo Sportnetu zmenou tohto údaja a `data/klub.json`), `ukazka` zapína pás „Návrh webu“, `noindex` zakazuje indexovanie, `adminDemo` pridá ukážku administrácie.

Výsledky sa po zápasoch aktualizujú samé cez GitHub Actions (`.github/workflows/sportnet.yml`).
