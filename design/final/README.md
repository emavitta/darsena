# Darsena — identità e schermata iniziale in lavorazione

Il confronto fra tre agenti ha prodotto una proposta cartografica, una editoriale astratta e una materica. L'utente ha scelto l'idea cartografica, chiedendo una resa piatta. Questa resta la direzione dell'icona; le prime illustrazioni materiche sono archiviate.

La geometria segue il riferimento geografico fornito dall'utente: il bacino si allunga verso nord-ovest; gli innesti dei due Navigli sono nella porzione sud-est, a destra. Da quel nodo il Naviglio Grande prosegue verso sud-ovest e il Naviglio Pavese verso sud. Non è un semplice riflesso orizzontale del primo disegno.

Il segno usa isolati neutri e acqua in blu oltremare, senza texture, ombra o estrusione. Le schermate operative restano neutre.

## Seconda iterazione

Il feedback sul primo `preview.png` chiede meno rigidità, alcune curve leggere, nessun nome sulla mappa e prove con i Navigli che terminano in pochi tratti sempre più corti. La città resta un contesto grigio discreto. Le prove in `design/proposals/cartografica-v2/` confrontano il taglio ai bordi con una composizione interamente contenuta. Sono varianti da valutare, non un'identità definitiva approvata.

L'icona corrente deriva dalla proposta **C**: composizione contenuta, tre frammenti decrescenti alle estremità. **B** mantiene gli stessi ingombri con canali continui; **A** estende la mappa oltre il bordo. Il confronto è in `design/proposals/cartografica-v2/preview.png`.

## Schermata iniziale — settembre 2026

L'icona è ora più grande e affiancata dal nome: 112 px nel benvenuto, 144 px durante il caricamento e 104 px in About. Il caricamento segue lo stato reale dell'app, senza un'attesa artificiale.

Il benvenuto e About condividono una nuova illustrazione in blu e grigio su fondo chiaro, basata sull'ultima fotografia panoramica dell'utente: bacino in primo piano, banchina curva a destra, porta sul fondo vista di lato e quercia arretrata. Un tram storico milanese e pochi binari completano la strada rialzata sulla destra.

L'utente ha chiesto di rimuovere il mercato moderno e ridurre il dettaglio; fogliame, facciate e riflessi sono più semplici. È un'interpretazione illustrata con omissioni deliberate, non una ricostruzione di un preciso anno storico. Nessun cipresso o nome nella tavola. La proposta resta soggetta alla valutazione dell'utente.

Riferimenti, metodo e prompt sono in [waterfront-v12.md](waterfront-v12.md). `node --import tsx scripts/preview-brand.mjs` genera le anteprime di benvenuto e About con dati temporanei, nei due temi e alla dimensione minima della finestra.

## File di produzione

- `public/brand/icon.svg`: master vettoriale dell'icona.
- `public/brand/icon-small.svg`: variante senza il frammento subpixel per i formati macOS 16/32 pt.
- `public/brand/icon.png`: raster per Electron e Dock.
- `public/brand/mark.svg`: segno piccolo.
- `public/brand/waterfront-v12.png`: illustrazione proposta per il benvenuto e About Darsena.
- `public/brand/harbor.svg` e `harbor-dark.svg`: precedenti tavole cartografiche, conservate come riferimento.
- `build/icon.icns`: pacchetto delle dimensioni macOS.

`node scripts/icons.mjs` rigenera PNG e ICNS dal master SVG. L'icona è un vettoriale originale; l'illustrazione è un raster generato con ImageGen. Proporzioni e isolati sono semplificati per l'uso grafico, non un rilievo geografico.

Contesto del luogo: [Comune di Milano — zona portuale della Darsena](https://www.comune.milano.it/aree-tematiche/impresa/organizzare-un-evento/occupazione-spazi-in-darsena). La mappa allegata dall'utente è stata usata come riferimento di orientamento e continuità dei canali, senza incorporarne le immagini nel prodotto.
