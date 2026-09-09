# Darsena — analisi iniziale

Data: 9 settembre 2026. Stato: analisi in corso, aggiornata con le risposte.

Questo documento conserva l'analisi iniziale e le decisioni. La prima implementazione
è ora presente; il [README](../README.md) descrive lo stato effettivo e i limiti.
Non sono stati avviati servizi o modificati file di mago-app.

Decisioni confermate nella conversazione:

- Prima versione macOS; apertura in Terminale, VS Code e Android Studio.
- Gestire worktree esistenti, creati da persone, agenti o altri strumenti.
- Creazione/rimozione worktree rimandate.
- Il prodotto serve a orientarsi, aprire strumenti e avviare il progetto nel
  worktree giusto. Nessun visualizzatore diff interno pianificato.
- Git fornisce informazioni di contesto; revisione del codice negli strumenti esterni.
- Preferiti dei task per progetto, riutilizzati nei suoi worktree; definizione
  del task risolta nel worktree selezionato.
- Esecuzione interna dalla prima versione: vedere cosa gira e dove, consultare
  i log e interrompere i task. Il caso centrale è un server in un worktree che
  può impedire l'avvio del servizio in un altro.
- Chiusura finestra: Darsena resta attiva in background e i task continuano.
  Esci arresta i task avviati da Darsena. Nessuna preferenza che associ la
  chiusura della finestra allo stop dei task nella prima versione.
- L'avvio di server da agenti, terminali e IDE è un caso normale da considerare;
  non richiedere all'utente di quantificarne la frequenza. Riconoscimento di
  processi esterni nei limiti dei dati osservabili, senza inventare attribuzioni.
- Fare domande nella chat, una alla volta, con una raccomandazione motivata.
- Primi utenti: uso quotidiano personale, poi colleghi interessati.
- Preparazione automatica dei worktree rimandata; eventuali task di setup
  possono essere eseguiti esplicitamente. Le configurazioni interne dei progetti
  continuano a gestire i loro prerequisiti.
- Identità legata alla Darsena milanese: icona e grafica minima incluse.

Ancora da decidere: dettagli della discovery e configurazione condivisa,
conflitti e processi esterni, stack desktop definitivo. La proposta
aggiornata per task e preferiti è in [task-discovery.md](task-discovery.md).

## 1. Problema e promessa

Gli agenti moltiplicano i checkout; la verifica umana richiede ritrovare il
worktree giusto, capire cosa contiene, aprire il sottoprogetto corretto e
lanciare una verifica senza confondere percorsi e processi.

**Darsena riduce i passaggi necessari per verificare un lavoro nel suo contesto.**

Un flusso concreto:

1. Aggiungere mago-app una volta.
2. Vedere tutti i suoi checkout registrati in Git, anche quelli creati altrove.
3. Selezionare un worktree identificandolo per nome, branch e percorso.
4. Aprire `shells/wtc-android` di quel worktree in Android Studio.
5. Scegliere un task del progetto ed eseguirlo nel worktree selezionato;
   vedere worktree, stato e log dell'esecuzione e poterla interrompere.

La misura iniziale di utilità è il tempo e il numero di passaggi di questo
flusso rispetto all'uso attuale di Finder, terminale e console. Il test deve
usare un progetto reale e almeno un repository senza package.json.

## 2. Cosa esiste già in mago-app

Ispezione locale in sola lettura:

- Root di esempio: `~/Code/mago-app`.
- `package.json`: `dev:console` esegue `node scripts/dev.mjs --console`.
- `tools/dev-console` contiene una dashboard Vue e un daemon Node locale.
- Git ha restituito sei checkout, incluso quello principale, al momento dell'analisi.
- La discovery usa `git worktree list --porcelain`; comprende i worktree degli
  agenti senza dipendere da un servizio di agenti.
- La console apre già cartelle specifiche in VS Code, possiede processi,
  conserva log e consente di fermarli.
- `dev.config.json` descrive servizi e hostname stabili. La console tratta i
  conflitti di hostname e propone un trasferimento tra worktree.
- Il percorso Android presente è `shells/wtc-android`.
- Il supervisor attuale avvia pnpm; la discovery e il registry sono specifici
  di Mago. Darsena deve esprimere comandi generici e cartelle relative.

Riferimenti locali:

- `mago-app/tools/dev-console/README.md`
- `mago-app/tools/dev-console/core/worktrees.mjs`
- `mago-app/tools/dev-console/core/editor.mjs`
- `mago-app/tools/dev-console/server/supervisor.mjs`
- `mago-app/dev.config.json`

Da riprendere: identità del worktree visibile, percorsi relativi, proprietà dei
processi, log limitati, consapevolezza dei conflitti. L'implementazione attuale
è materiale di riferimento, non una dipendenza di Darsena.

## 3. Critiche da affrontare prima di costruire

1. **“Aggiungi Git” può trasformarsi in un altro intero prodotto.** Decisione
   presa: informazioni di orientamento in Darsena; revisione e diff rimangono
   negli strumenti esterni. Stage, commit e rebase non sono nel piano attuale.
2. **“Switchare” nasconde tre comportamenti.** Selezionare un worktree cambia
   il contesto della UI; aprirlo lancia uno strumento; trasferire un servizio
   richiede stop, avvio e gestione di porte e URL. Sono azioni distinte.
3. **Una lista di script npm non basta per essere agnostici.** Il nucleo è un
   eseguibile con argomenti, directory, ambiente e ciclo di vita. package.json
   è una possibile sorgente di suggerimenti, non il modello del prodotto.
4. **Un branch pulito può contenere tutto il lavoro dell'agente già committato.**
   L'indicatore di modifiche locali non deve suggerire che un branch pulito
   sia privo di lavoro da controllare o già verificato.
5. **“Agente al lavoro” non si deduce da un nome di branch o da un file recente.**
   Mostrare solo ciò che è osservato: modifiche Git e processi gestiti da Darsena.
   Integrazioni con agenti specifici vengono dopo, se servono davvero.
6. **Il pulsante Stop è parte della funzionalità, non un dettaglio finale.**
   Un task può generare figli, aprire un daemon o richiedere input interattivo.
   La UI deve dichiarare cosa controlla e non fingere di possedere processi esterni.
7. **Un test verde invecchia mentre l'agente continua a scrivere.** Registrare
   contesto ed esecuzione; non presentare un vecchio successo come certificazione
   del codice corrente. Durante scritture concorrenti il risultato è da ricontrollare.
8. **Partire con un framework di plugin rallenta l'apprendimento.** Prima un
   formato semplice per cartelle e comandi; adattatori solo quando i casi reali
   dimostrano che servono.
9. **Il tema del porto deve aiutare il marchio.** Nei controlli operativi usare
   Worktree, Cartelle, Comandi; evitare di ribattezzarli moli, navi e marinai.

## 4. Electron o Tauri

| Aspetto | Electron | Tauri 2 |
| --- | --- | --- |
| UI Nuxt | UI compilata, eseguita in Chromium | UI compilata, eseguita nella webview del sistema |
| Backend locale | Node.js / TypeScript | Rust, API e plugin Tauri |
| Runtime distribuito | Include Chromium e Node.js | Usa la webview disponibile nel sistema |
| Git, filesystem, processi | API Node e strumenti di sistema | API Rust e strumenti di sistema |
| Uniformità rendering | Chromium incluso nell'app | Motore diverso tra sistemi operativi |
| Iterazione per questo progetto | Un linguaggio per UI e backend; esperienza di dev-console riutilizzabile | Richiede anche implementazione e manutenzione Rust |
| Dimensioni | Runtime incluso con costo di distribuzione | In genere pacchetto più piccolo grazie alla webview di sistema |

**Raccomandazione iniziale: Electron + Nuxt 4 + TypeScript.**

È una valutazione per Darsena: gestione dei processi e integrazione con gli
strumenti del developer sono centrali; un backend Node riduce il numero di
tecnologie da mantenere. Non è un'affermazione che Tauri non possa svolgere
queste funzioni. Non sono stati eseguiti benchmark di memoria o avvio.

Sceglierei Tauri se la priorità fosse una piccola utility sempre aperta e
dimensioni/consumi contassero più del vantaggio di scrivere tutto in TypeScript.
I consumi andrebbero comunque misurati con lo stesso carico reale.

Nuxt viene usato per componenti, composable, routing e build della UI, con
`ssr: false` e output statico. Nessun server Nuxt necessario nel prodotto
installato. Git e processi vengono gestiti dal backend desktop.

Fonti ufficiali consultate:

- [Electron: process model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron: context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Tauri: architecture](https://v2.tauri.app/concept/architecture/)
- [Tauri: Nuxt](https://v2.tauri.app/start/frontend/nuxt/)
- [Tauri: shell plugin](https://v2.tauri.app/plugin/shell/)
- [Nuxt: deployment e client-side rendering](https://nuxt.com/docs/4.x/getting-started/deployment)
- [Node: child processes](https://nodejs.org/api/child_process.html)
- [Git: worktree](https://git-scm.com/docs/git-worktree)

## 5. Incrementi proposti

### 0.1 — Ritrovare, aprire e avviare

- macOS, confermato.
- Aggiungi progetto scegliendo una cartella; accetta anche un worktree collegato
  e ricava il repository comune, evitando progetti duplicati.
- Lista progetti persistente, preferiti e ultimo contesto selezionato.
- Checkout principale e worktree scoperti tramite Git.
- Nome, branch o detached HEAD, percorso, stato modificato/pulito e numero di
  file modificati; stati mancanti/bloccati visibili quando segnalati da Git.
- Ricerca locale quando la lista cresce; aggiornamento manuale e al ritorno
  nell'app, con stato di caricamento distinto da una lista vuota.
- Cartelle configurabili con percorso relativo al worktree selezionato.
- Apri in VS Code, Terminale, Android Studio; copia percorso / mostra in Finder.
- Messaggi concreti per Git assente, cartella mancante o app non disponibile.
- Interfaccia per configurare le cartelle, senza dover scrivere JSON.
- Icona del marchio, icone dei controlli e stato vuoto curato.

Criterio di completamento: scegliere due worktree diversi di mago-app e aprire
la loro rispettiva cartella Android senza modificare il collegamento salvato;
aggiungere anche un repository senza Node; ritrovare preferiti al riavvio.

### Task — esecuzione interna inclusa in 0.1

L'utente ha scelto l'esecuzione interna: sapere cosa gira e in quale worktree
è centrale nel bisogno espresso. Il primo incremento deve coprire il ciclo
avvio → stato/log → stop insieme alla navigazione dei worktree.

- Scoprire gli script nei package.json delle cartelle interessate.
- Selezionare task e preferiti dalla UI; configurazione condivisa opzionale.
- Consentire comandi generici e progettare la scoperta dei task Gradle.
- Eseguire nella cartella relativa del worktree selezionato.
- Task preferiti comuni ai worktree del progetto, confermato.
- Includere log, exit code, Stop e gestione dei processi figli controllabili.
- Riepilogo dei task in corso visibile anche cambiando progetto o worktree.
- Conflitti di porte/hostname e processi esterni sono la prossima decisione.

La proposta completa è in [task-discovery.md](task-discovery.md). L'apertura
del terminale nella cartella resta un'azione disponibile; il lancio dei task
preferiti usa il runner interno.

### Dopo il primo uso quotidiano

Creazione/rimozione worktree; terminale interattivo; discovery di
altri runner; PR/CI; eventuali integrazioni agenti; distribuzione multipiattaforma.

Trasferimento di servizi e risorse esclusive come porte/hostname sono ora in
discussione per il primo flusso di esecuzione, non rimandati automaticamente.

Nessuna di queste funzioni è implicitamente inclusa nel primo incremento.

## 6. UX della schermata principale

Struttura proposta:

```text
Progetti              Worktree                    Dettaglio selezionato
★ mago-app            main                        feat/sip-provider
  altro-progetto      feat/sip-provider            percorso completo
+ Aggiungi            feat/…                      stato Git

                                                  Repository   [Code] [Terminale]
                                                  WTC Android  [Android Studio]
                                                  Call         [Code] [Terminale]
```

Le cartelle sono scorciatoie di progetto, risolte ogni volta nel worktree
selezionato. L'azione principale mostra sempre la cartella destinataria.
Una cartella assente in un vecchio branch resta riconoscibile come non disponibile.

Per il primo incremento basta una vista con lista e dettaglio, oltre alle
impostazioni. Il dettaglio può ospitare task preferiti e accesso agli altri task.
Un riepilogo dei processi in corso resta visibile passando tra worktree;
ogni esecuzione conserva il proprio progetto, worktree e percorso di avvio.

Preferire righe compatte a grandi card: la densità deve reggere decine di
worktree. Nome leggibile in primo piano, branch e percorso sempre recuperabili.
Il nome del branch non viene usato come identità stabile del worktree.

Selezionare un worktree cambia soltanto il contesto della UI. Aprire app o
avviare/fermare processi richiede l'azione corrispondente. Niente cambi di branch
impliciti nella cartella che un IDE ha già aperto.

## 7. Configurazione: UI semplice, file condivisibile

Due responsabilità, con una sola schermata di impostazioni di progetto:

**Impostazioni locali dell'app**: progetti aggiunti, preferiti, ultimo worktree,
app installate e relativi percorsi, preferenze di apertura, personalizzazioni
di quel progetto. Persistenza JSON nell'area dati dell'app, con scritture
atomiche e versione del formato.

**File opzionale `.darsena.json` nel repository**: nomi e percorsi relativi delle
cartelle, app suggerite tramite identificatori logici, comandi condivisi.
Il progetto funziona anche senza file. L'utente può esportare/condividere la
configurazione dalla UI con un'azione esplicita.

Regole proposte:

1. I valori scoperti sono suggerimenti da aggiungere, non impostazioni scritte
   automaticamente e non comandi eseguiti durante l'aggiunta del progetto.
2. La configurazione condivisa viene letta dal checkout selezionato.
3. In assenza del file si usa la configurazione personale salvata per il progetto,
   senza prendere di nascosto comandi da un altro branch.
4. Le personalizzazioni locali prevalgono sui valori condivisi, con provenienza
   indicata nella UI. Collezioni identificate per `id`; nessun merge ambiguo per indice.
5. File invalidi producono un errore localizzato; non spariscono tutte le cartelle
   né vengono avviati vecchi comandi fingendo che la nuova configurazione sia valida.
6. Percorsi delle app e segreti restano locali. Le directory dei target sono
   relative alla radice del worktree, non al checkout principale.
7. La prima adozione dei comandi condivisi li mostra all'utente. Cambi a comando,
   argomenti, directory o ambiente sono resi visibili prima dell'esecuzione.
8. Percorsi risolti e symlink sono validati nel backend: una cartella che esce
   dal worktree richiede una scelta locale esplicita, non un percorso nascosto nel file.

Vedere `examples/mago-app.darsena.json`: è un esempio del formato proposto,
non una configurazione già supportata. Mostra comandi personalizzati espliciti;
per i task scoperti la proposta aggiornata salva un riferimento al task, senza
copiare la sua implementazione. La versione di rilascio dei task è da decidere.
Non esegue il vecchio dev:console: quel comando avvierebbe un altro supervisore,
con un ciclo di vita distinto da quello posseduto da Darsena.

## 8. Architettura minima proposta

UI Nuxt → API desktop tipizzata → servizi locali Git, progetti, opener, task.

- UI: Vue 3, Composition API, `<script setup lang="ts">`; schermate sottili e
  componenti distinti per lista progetti, lista worktree, dettaglio e form.
- API: operazioni esplicite come `listWorktrees`, `openTarget`, `runTask`.
  Nessun accesso generale a shell o filesystem esposto dalla pagina.
- Electron: renderer isolato e sandbox, Node disabilitato nella UI, preload
  con API ristrette e parametri validati; UI locale, nessuna pagina di progetto
  caricata con privilegi desktop.
- Backend: moduli TypeScript con responsabilità separate; Git asincrono tramite
  CLI installata sul computer, argomenti separati e limiti di tempo/output.
- Persistenza: JSON versionato sufficiente inizialmente; SQLite quando ricerche
  e storico delle esecuzioni lo giustificano.
- Nessun daemon autonomo iniziale. Il processo principale dell'app resta attivo
  quando si chiude la finestra, mantenendo supervisione e log; riaprire la
  finestra recupera lo stato corrente. Esci avvia lo shutdown dei task gestiti
  prima di terminare l'app. Comportamento confermato, fisso nella prima versione.
- Lo shutdown riguarda i task posseduti da Darsena e i relativi figli gestibili.
  Osservare un processo esterno non ne trasferisce la proprietà a Darsena:
  tali processi non vengono arrestati uscendo dall'app.

Non creare oggi un monorepo di pacchetti o un SDK di plugin. Separare i servizi
dal bridge evita accoppiamenti inutili, ma non rende un eventuale porting Rust gratuito.

## 9. Dettagli che fanno la differenza

### Git

Usare il repository comune per raggruppare checkout, non remote URL o cartelle
convenzionali degli agenti. `git worktree list --porcelain -z` evita parsing
fragile di percorsi con spazi o caratteri speciali. Distinguere bare repository,
checkout principale, detached HEAD e record non più presenti sul disco.

Per stato e nomi file usare output strutturato e delimitato da NUL. La discovery
non dipende da una scansione ricorsiva del monorepo. Richiedere stato del checkout
selezionato subito e degli altri con concorrenza limitata; non bloccare la UI.

Un errore Git non significa “nessun worktree”. Stato sconosciuto non significa
pulito. Eventuali contatori ahead/behind si riferiscono alle ref locali disponibili;
indicare l'ultimo fetch se in futuro vengono aggiunti aggiornamenti remoti.

La revisione del branch e i diff sono delegati agli strumenti esterni. Nessun
assunto che tutti i progetti usino `main`; l'indicatore di modifiche locali
descrive la working copy, non il completamento del lavoro nel branch.

### Comandi

Modello base: `command`, `args`, target/cwd, tipo oneshot/service; ambiente
aggiunto quando necessario. L'esempio usa pnpm, ma lo stesso modello consente
`cargo test`, `go test ./...`, `python -m pytest`, `./gradlew test` o script locali.
La disponibilità della toolchain resta requisito del progetto.

Gli eseguibili vengono avviati con argomenti separati. Pipeline e operatori
shell richiedono una modalità dichiarata, non concatenazione implicita di stringhe.
Gestire PATH e tool manager della sessione grafica: aprire da Finder non garantisce
lo stesso ambiente di un terminale. Mostrare il comando e la directory risolti.

Per il runner interno scelto, la prima implementazione proposta gestisce
stdout/stderr non interattivi e non emula un terminale.
TUI, prompt e richieste di password vanno aperti nel terminale esterno fino
all'introduzione di un PTY. I log sono testo con capacità limitata; mai HTML eseguibile.

Start/Stop sono associati a una singola esecuzione e al suo worktree. Gestire
figli, timeout ed escalation; non terminare processi esterni solo perché usano
la stessa porta. Daemon e servizi condivisi possono sopravvivere al comando:
vanno trattati esplicitamente, non promessi sotto il controllo del runner generico.

Processo avviato e servizio pronto sono stati diversi. Un URL rilevato è un
collegamento, non una verifica di salute. Un task concluso con successo è diverso
da un servizio ancora in esecuzione.

### Worktree e ambiente

I worktree condividono parti del repository Git, ma dipendenze, file ignorati,
variabili e output di build possono essere assenti. Aprire Android Studio deve
funzionare anche se il progetto richiederà poi setup locale. Provisioning e
copie automatiche di `.env` restano fuori dal primo incremento.

## 10. Identità visiva

Direzione da esplorare: D geometrica con spazio interno che ricorda una darsena
vista dall'alto; un accenno di canale, leggibile anche a piccole dimensioni.
Tipografia sobria, superfici neutrali, accento petrolio, stati Git e processi
distinti anche mediante testo e simboli.

Produrre durante la prima UI:

- marchio vettoriale originale e variante monocromatica;
- icona desktop ed esportazioni richieste dal sistema scelto;
- icone dei comandi coerenti tratte da una sola libreria;
- una piccola illustrazione originale per lo stato senza progetti.

La UI operativa privilegia spazio per nomi, percorsi, cartelle e task. Immagini del
porto servono solo dove aiutano riconoscibilità e stato vuoto. Tema e lingua
dell'interfaccia sono decisioni reversibili; ipotesi: tema di sistema e UI inglese.

## 11. Domande aperte

Procedere nella chat una domanda alla volta. Sistemi operativi, app iniziali,
gestione dei worktree esistenti e assenza di diff interno sono stati chiariti.
Restano da discutere:

1. Dettagli operativi per conflitti e attribuzione dei processi esterni, trattati
   come caso normale senza altre domande sulla loro frequenza.
2. Discovery dei task e configurazione condivisa opzionale; i preferiti per
   progetto e l'esecuzione interna sono già confermati.
3. Flusso reale di avvio in mago-app e ruolo desiderato di dev:console.
4. Significato principale di switch: aprire, trasferire servizi o confrontare
   più servizi simultanei.
5. Uso personale, team o prodotto pubblico.
6. Priorità tra semplicità TypeScript e leggerezza del runtime.

Il percorso di mago-app è stato trovato autonomamente. Restano da capire
quali sottoprogetti/comandi siano i primi due o tre da rendere immediati.

Da risolvere soltanto prima degli incrementi interessati: comandi interattivi,
porte/hostname fissi, setup dei
worktree, preferenze degli editor e distribuzione firmata. Le scelte iniziali
vanno aggiornate qui dopo le risposte, evitando di trasformare le ipotesi in requisiti.
