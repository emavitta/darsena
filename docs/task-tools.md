# Strumenti, icone e prossimi adattatori

Stato: 9 settembre 2026. Le funzionalità indicate come presenti sono implementate;
le priorità sotto sono una proposta per gli incrementi successivi.

## Modello attuale

Una sola lista di task, con icona e nome dello strumento. Il tipo di sorgente
(`package.json`, Gradle, comando salvato) resta indipendente dallo strumento:
un comando pnpm aggiunto manualmente compare nello stesso filtro dei task pnpm
scoperti. Il tooltip specifica che è un comando salvato e mostra l'eseguibile.

Il riconoscimento guarda il nome dell'eseguibile, anche in un percorso assoluto,
e alcuni wrapper noti. Non esegue nulla, non controlla che lo strumento sia
installato e non cerca di interpretare il contenuto degli script.
`pnpm run android` rimane pnpm anche se lo script richiama Gradle: mostrare il
runner effettivamente invocato evita un'etichetta dedotta dal corpo del task.

- Loghi: npm, pnpm, Yarn, Bun, Gradle, Python, uv, Cargo (simbolo Rust), Go,
  Node.js, Maven, Docker, Task. npx usa il simbolo npm.
- Icone funzionali: Shell per gli interpreti shell e i file `.sh`, `.bash`, `.zsh`;
  chiave per Make, elenco per Just, terminale per comandi sconosciuti.
- I nomi restano sempre visibili e i loghi seguono il contrasto del badge.
- Nessuna scansione di tutti gli `.sh` del repository: molti sono helper o
  richiedono argomenti. L'utente sceglie esplicitamente quelli da salvare.

## Aggiungere uno script

**Custom command → Shell script**:

- Display name: `Prepare dev`
- Working folder: root, oppure una scorciatoia del progetto
- Script path: `scripts/prepare.sh`, relativo alla cartella scelta
- Run with: Bash, Zsh o Sh, secondo il linguaggio dello script
- Arguments: un argomento per riga, opzionali

Il preset salva un comando normale, per esempio
`bash -- ./scripts/prepare.sh`, nei preferiti del progetto. Quando si avvia in
un altro worktree, legge il file presente lì; non copia lo script. Non serve
modificare i permessi. Si può usare anche il modo Command con eseguibile
`./scripts/prepare.sh`: in quel caso servono permesso eseguibile e shebang valido.
La scelta esplicita dell'interprete è descritta nel
[manuale Bash](https://www.gnu.org/software/bash/manual/html_node/Shell-Scripts.html).

Il runner conserva cartella, argomenti e log; non espande `&&`, pipe o variabili
negli argomenti. Per una sequenza complessa si scrive il corpo nel file script.
Il preset verifica che il percorso sia relativo, ma la presenza del file viene
verificata dall'interprete all'avvio. Il runner attuale non fornisce input
interattivo o PTY: per prompt e REPL usare Terminal.

## Copertura e ordine proposto

| Famiglia                                          | Oggi                                                              | Prossimo incremento utile                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| npm, pnpm, Yarn, Bun                              | Discovery di `package.json` e avvio con il manager della cartella | Migliorare solo ambiguità concrete dei monorepo                                    |
| Gradle                                            | Wrapper e caricamento esplicito dei task                          | Migliorare cache/aggiornamento sulla base dell'uso reale                           |
| Shell                                             | Preset dedicato, scelta dell'interprete, icona Shell              | Eventuale selettore di file limitato al worktree                                   |
| Make, Just, Taskfile                              | Comandi manuali e icone                                           | Prima priorità per nuovi elenchi di task: sono indipendenti dal linguaggio         |
| Python/uv, Cargo, Go, Maven, .NET                 | Comandi manuali; logo riconosciuto per i primi cinque             | Preset selezionabili per test/build/run; non fingere un catalogo comune di task    |
| Docker Compose                                    | Comando manuale e logo Docker                                     | Gestione esplicita dei servizi, prima di promettere controllo completo dello stato |
| Flutter, Xcode, Ruby/Bundler, PHP/Composer, CMake | Comandi manuali con icona generica                                | Adattatori su richiesta, quando una codebase concreta ne ha bisogno                |

Just espone un [elenco di ricette](https://just.systems/man/en/listing-available-recipes.html);
Taskfile dispone di un [elenco anche JSON](https://taskfile.dev/docs/reference/cli).
Sono quindi candidati più diretti alla discovery rispetto a un generico comando
CLI. Per Make va progettato un caricamento esplicito e testato: il suo
[manuale](https://www.gnu.org/software/make/manual/make.html) descrive eccezioni
anche alle opzioni di mancata esecuzione. Una regex su Makefile non basta per
include, variabili e regole generate.

Per strumenti come Cargo, partirei da preset di comandi documentati, per esempio
[cargo test](https://doc.rust-lang.org/cargo/commands/cargo-test.html), selezionati
dall'utente. Un badge non equivale a una nuova integrazione di discovery.

Docker richiede un trattamento distinto del ciclo di vita: con
[`docker compose up -d`](https://docs.docker.com/reference/cli/docker/compose/up/)
il comando termina e i container continuano. Darsena oggi segue il processo CLI;
lo stato "succeeded" non certifica che i servizi siano spenti e Quit non arresta
i container lasciati in background. L'integrazione futura dovrebbe conoscere
progetto Compose, worktree, servizi e azione di stop esplicita.

La raccomandazione è consolidare questo flusso, poi aggiungere un adattatore per
volta. L'agnosticità viene dal runner comune e dai comandi salvabili, non dal
numero di file di configurazione che proviamo a interpretare.
