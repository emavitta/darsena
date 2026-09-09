# Atlante — direzione finale piatta

L'icona è un ritaglio ravvicinato di planimetria urbana: il bacino occupa il ramo lungo che parte in alto a sinistra, piega e raggiunge la testata a destra. Da quella zona si aprono il Naviglio Grande verso sinistra/basso e il Pavese verso il basso, leggermente inclinato. La geometria è stata ricostruita sulla topologia della vista aerea fornita dall'utente: la vecchia forma a semicerchio e le bocche agli estremi opposti sono state abbandonate.

La piccola rientranza sulla sponda destra richiama il taglio della banchina; i blocchi neutri danno contesto urbano senza rendere l'icona una carta stradale dettagliata. Il marchio mantiene la stessa orientazione della mappa.

Il disegno usa esclusivamente campiture piatte: nessuna sfumatura, texture, ombra, bisello, riflesso o bordo illuminato. I ponti sono soltanto piccoli segmenti nell'illustrazione, omessi nell'icona per tenere i canali continui alle dimensioni del Dock.

## Asset finali

- `icon.svg` / `icon.png`: icona macOS 1024 px, margine trasparente 62 px, contesto urbano.
- `mark.svg`: silhouette monocromatica `currentColor`, ottimizzata per 24 px e orientata come la mappa.
- `harbor.svg` / `harbor-dark.svg`: illustrazioni di geometria identica, con palette chiara e scura. Tre sole etichette, fuori dall'acqua.
- `preview.png`: tavola con icona grande, controllo 64/32/24 px, marchio e illustrazione.
- `harbor-dark.png`: render della variante scura.

## Colori

| Uso | Chiaro | Scuro |
| --- | --- | --- |
| Fondo | `#F4F5F2` | `#20232A` |
| Isolati | `#E5E7E2` | `#292D35` |
| Acqua | `#2D46C8` | `#728BFA` |
| Etichette | `#737A88` | `#B9C0D0` |

## Controlli e limiti

Controllati i render a 24, 32, 64 e 1024 px. Un secondo agente ha confrontato l'orientamento e le connessioni con la vista aerea. La forma è uno schema originale, non un rilievo: il tracciato e la topologia fanno riferimento al luogo, mentre gli isolati sono composizioni astratte. Il riferimento generale a bacino, Grande e Pavese è coerente con il [Comune di Milano](https://www.comune.milano.it/aree-tematiche/impresa/organizzare-un-evento/occupazione-spazi-in-darsena).

L'illustrazione è pensata per un solo empty state o onboarding. La UI deve rimanere neutra; la cartografia non serve da sfondo ai task.
