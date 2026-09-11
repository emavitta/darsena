# Darsena — identità e schermata iniziale in lavorazione

Il confronto fra tre agenti ha prodotto una proposta cartografica, una editoriale astratta e una materica. L'utente ha scelto l'idea cartografica, chiedendo una resa piatta. Questa resta la direzione dell'icona; le prime illustrazioni materiche sono archiviate.

La geometria segue il riferimento geografico fornito dall'utente: il bacino si allunga verso nord-ovest; gli innesti dei due Navigli sono nella porzione sud-est, a destra. Da quel nodo il Naviglio Grande prosegue verso sud-ovest e il Naviglio Pavese verso sud. Non è un semplice riflesso orizzontale del primo disegno.

Il segno usa isolati neutri e acqua in blu oltremare, senza texture, ombra o estrusione. Le schermate operative restano neutre.

## Seconda iterazione

Il feedback sul primo `preview.png` chiede meno rigidità, alcune curve leggere, nessun nome sulla mappa e prove con i Navigli che terminano in pochi tratti sempre più corti. La città resta un contesto grigio discreto. Le prove in `design/proposals/cartografica-v2/` confrontano il taglio ai bordi con una composizione interamente contenuta. Sono varianti da valutare, non un'identità definitiva approvata.

L'icona corrente deriva dalla proposta **C**: composizione contenuta, tre frammenti decrescenti alle estremità. **B** mantiene gli stessi ingombri con canali continui; **A** estende la mappa oltre il bordo. Il confronto è in `design/proposals/cartografica-v2/preview.png`.

## Icona — riferimenti della piazza

La nuova variante mantiene il bacino e i due Navigli e aggiunge tre elementi in pianta, alla testata orientale: Porta Ticinese come un semplice rettangolo grigio, la quercia con una chioma irregolare e un piccolo rettangolo giallo-arancio per il tram. Due isolati generici lasciano spazio alla piazza. Il feedback successivo elimina tetto, colonnato, finestrini e rotaie: restano solo campiture piatte, senza prospettiva, texture o scritte.

Il colore distingue le funzioni: acqua blu `#2D46C8`, porta grigia `#929B95` più scura degli isolati, quercia verde `#68976B` e tram giallo-arancio `#E4A23B`. Dimensioni e distanze restano adattate all'icona: la quercia è separata dal bacino e si trova a sud-ovest della porta. Per l'orientamento sono stati consultati [Porta Ticinese su OpenStreetMap](https://www.openstreetmap.org/way/172927160), [la posizione della quercia](https://www.openstreetmap.org/node/1957473688) (© OpenStreetMap contributors) e [la scheda del Comune di Milano](https://www.comune.milano.it/argomenti/ambiente-e-animali/gli-alberi-monumentali-a-milano/la-quercia-di-piazza-xxiv-maggio). Le forme vettoriali sono disegnate per il progetto, senza incorporare mappe o fotografie.

Le stesse tre sagome sono presenti a tutte le dimensioni. Nei formati piccoli viene omesso solo l'ultimo frammento subpixel dei Navigli. A 16/32 px il riconoscimento resta affidato soprattutto all'acqua: porta, albero e tram sono piccoli accenti di colore.

`node scripts/preview-icon.mjs` genera [l'anteprima a più dimensioni](icon-landmarks-preview.png) su fondo chiaro e scuro e [l'icona a 512 px](icon-landmarks-512.png). Questa variante è già nei file di produzione locali e resta da valutare con l'utente; non cambia gli installer della Release `v0.1.0` già pubblicata.

## Schermata iniziale — settembre 2026

L'icona è ora più grande e affiancata dal nome: 112 px nel benvenuto, 144 px durante il caricamento e 104 px in About. Il caricamento segue lo stato reale dell'app, senza un'attesa artificiale.

Il benvenuto e About condividono una nuova illustrazione in blu e grigio su fondo chiaro, basata sull'ultima fotografia panoramica dell'utente: bacino in primo piano, banchina curva a destra, porta sul fondo vista di lato e quercia arretrata. Un tram storico milanese e pochi binari completano la strada rialzata sulla destra.

L'utente ha chiesto di rimuovere il mercato moderno e ridurre il dettaglio; fogliame, facciate e riflessi sono più semplici. È un'interpretazione illustrata con omissioni deliberate, non una ricostruzione di un preciso anno storico. Nessun cipresso o nome nella tavola. La proposta resta soggetta alla valutazione dell'utente.

Riferimenti, metodo e prompt sono in [waterfront-v12.md](waterfront-v12.md). `node --import tsx scripts/preview-brand.mjs` genera le anteprime di benvenuto e About con dati temporanei, nei due temi e alla dimensione minima della finestra.

## Il racconto del nome e dell'icona

About conserva l'illustrazione e offre un link esplicito alla storia. Anche l'icona nel benvenuto e quella dentro About aprono la lettura; nella sidebar l'icona continua ad aprire About. Il racconto usa la stessa finestra, con ritorno ad About, chiusura sempre disponibile e gestione del focus da tastiera. Il testo resta in inglese, come l'interfaccia.

La Darsena e il trasporto del marmo di Candoglia verso il Duomo hanno la precedenza. Il testo distingue il bacino seicentesco dal precedente laghetto di Sant'Eustorgio e dall'approdo finale di Santo Stefano, nei pressi del cantiere. Seguono Porta Ticinese, la quercia e i tram Ventotto. La memoria documentata della quercia riguarda i caduti della **Prima guerra mondiale**, con la piantumazione del 1924; non viene attribuita alla Resistenza della Seconda guerra mondiale. Il richiamo alla tenacia nel significato dell'icona è dichiaratamente una scelta del progetto.

I testi e i collegamenti alle fonti sono in `app/content/brandStory.ts`; `BrandStory.vue` cura la lettura e `BrandAbout.vue` il passaggio tra le due viste. Le fonti si aprono nel browser tramite il collegamento già disponibile nell'app desktop. Il testo e le immagini restano locali e leggibili offline.

Le anteprime sono `story-light.png`, `story-dark.png`, `story-details-light.png`, `story-details-dark.png` e `story-compact.png`. Lo script di anteprima verifica anche gli ingressi dalla tastiera e dall'icona, il ritorno ad About, i collegamenti alle fonti e la chiusura dopo lo scorrimento.

## File di produzione

- `public/brand/icon.svg`: master vettoriale dell'icona.
- `public/brand/icon-small.svg`: variante senza frammento terminale subpixel dei Navigli per i formati macOS 16/32 pt.
- `public/brand/icon.png`: raster per Electron e Dock.
- `public/brand/mark.svg`: segno piccolo.
- `public/brand/waterfront-v12.png`: illustrazione proposta per il benvenuto e About Darsena.
- `public/brand/harbor.svg` e `harbor-dark.svg`: precedenti tavole cartografiche, conservate come riferimento.
- `build/icon.icns`: pacchetto delle dimensioni macOS.

`node scripts/icons.mjs` rigenera PNG e ICNS dal master SVG. L'icona è un vettoriale originale; l'illustrazione è un raster generato con ImageGen. Proporzioni e isolati sono semplificati per l'uso grafico, non un rilievo geografico.

Contesto del luogo: [Comune di Milano — zona portuale della Darsena](https://www.comune.milano.it/aree-tematiche/impresa/organizzare-un-evento/occupazione-spazi-in-darsena). La mappa allegata dall'utente è stata usata come riferimento di orientamento e continuità dei canali, senza incorporarne le immagini nel prodotto.
