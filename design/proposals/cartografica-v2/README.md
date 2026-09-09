# Cartografia v2 — prove da confrontare

La tavola `preview.png` (1800 × 438) confronta le tre prove alla stessa scala del bacino. I titoli sono fuori dalle illustrazioni; gli SVG non contengono testi visibili.

- **A — `studio-a.svg` / `.png`**: contesto esteso, canali e città proseguono oltre il ritaglio.
- **B — `studio-b.svg` / `.png`**: composizione contenuta, nessun isolato o canale tagliato dal bordo, estremità continue.
- **C — `studio-c.svg` / `.png`**: stessa composizione contenuta, canali continui per il 76% circa del percorso e tre frammenti finali sempre più brevi, a sezione costante.
- **C scura — `studio-c-dark.svg` / `.png`**: stessa geometria e palette richiesta per UI scura.

Tutte le illustrazioni singole sono 1200 × 640. Stessa forma del bacino, stessa posizione e scala; A aggiunge le prosecuzioni e il contesto periferico. La sponda lunga ha una convessità contenuta, il gomito sud-orientale è raccordato, il taglio della banchina rimane riconoscibile. Gli isolati hanno un ritmo più fitto e dimensioni diverse. L'orientamento segue il riferimento fornito dall'utente: bacino NW, testata SE/destra, Grande SW e Pavese S.

## Controllo icona

`icon-c.svg` è la prova C dentro un riquadro macOS con margine trasparente. PNG da 24, 32, 64, 128, 512 e 1024 px. Nei soli raster a 24/32 px è omesso il frammento terminale più minuto, che scenderebbe sotto il pixel. `icon-c-check.png` mostra dimensioni reali e segno monocromatico; `mark-c.svg` conserva quest'ultimo come vettore.

I frammenti sono trattini vettoriali calcolati sulla lunghezza geometrica reale dei Bézier, senza `pathLength`, sfumature o opacità. SVG e PNG quindi coincidono anche in librsvg/sharp.

## Raccomandazione

Porterei **C** alla prova nell'app: chiude la composizione senza un taglio netto e suggerisce che i Navigli continuino. **B** è l'alternativa più tranquilla se i segmenti sembrano troppo tecnici. Sono prove da decidere con l'utente, non una scelta definitiva. A 24/32 px la struttura resta leggibile ma i frammenti hanno poco peso: la preferenza per C va giudicata soprattutto nell'illustrazione.

Nessuna modifica ai file dell'app o agli asset pubblici. `generate.mjs` rigenera solo questa cartella.
