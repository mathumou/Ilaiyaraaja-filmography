# Ilaiyaraaja Filmography · இளையராஜா

A single-page static website listing the 1,542 films composed by the Maestro
Ilaiyaraaja (1970 – 2026), with bilingual (English + Tamil) titles, decade /
year / language filters, and incremental search.

Designed in a warm ivory + temple gold palette inspired by classic Tamil
cinema poster art.

## Repository layout

```
.
├── index.html                # the page
├── assets/
│   ├── styles.css            # theme + layout
│   ├── app.js                # filter / sort / lazy render
│   └── data/films.json       # film dataset
├── .nojekyll                 # disables Jekyll on GitHub Pages
└── README.md
```

## Preview locally

From this directory:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In the repo on github.com → **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Set **Branch** to `main` and folder to `/ (root)`. Save.
5. After a minute, the site is live at
   `https://<you>.github.io/<repo>/`.

`.nojekyll` is included so `assets/` files are served as-is without
Jekyll preprocessing.

## Posters

Each film card shows a poster image when one is available — currently
about 1,000 of the 1,542 films have a real photographic poster URL in
the dataset (sourced from Wikipedia / MusicBrainz / JioSaavn /
iTunes CDNs).

Films without an `"img"` URL render a styled fallback inside the card
(big initial letter on a warm gradient with a music-note motif), so the
grid stays visually consistent.

To add a poster, set the corresponding film's `"img"` field in
`assets/data/films.json` to a public image URL. The site picks up
changes on the next reload — a cache-buster on the JSON fetch ensures
the latest data is always loaded.

## Credits

Filmography data was compiled from:

- [Wikipedia](https://en.wikipedia.org/wiki/Ilaiyaraaja)
- [Wikidata](https://www.wikidata.org/wiki/Q2720141)
- [RaajaTheRaaja](https://www.raajatheraaja.com/)
- [MusicBrainz](https://musicbrainz.org/artist/34394522-a0f0-4675-aad2-30ac3cb3d7d3)
- [Discogs](https://www.discogs.com/artist/2154831-Ilaiyaraaja)
- [iTunes / Apple Music](https://music.apple.com/)

Dedicated to the Maestro · இசைஞானி இளையராஜா · who taught Tamil cinema how to sing.
