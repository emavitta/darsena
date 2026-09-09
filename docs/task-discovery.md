# Task e preferiti — proposta in discussione

Data: 9 settembre 2026. Documento di progettazione; il [README](../README.md)
descrive l'implementazione attuale e i suoi limiti. Confermati dall'utente: preferiti
comuni a tutti i worktree del progetto ed esecuzione interna con visibilità
dei processi e possibilità di interromperli. Gli altri dettagli restano proposte.

## Distinguere definizione, preferenza ed esecuzione

Il progetto definisce il task. Darsena scopre il task, permette di trovarlo e
salva un collegamento come preferito. Quando viene avviato, il riferimento si
risolve nel worktree selezionato.

Per uno script package.json il collegamento contiene tipo di sorgente,
percorso relativo del package.json e nome dello script. Non copia il corpo
dello script: `dev` deve eseguire la definizione di `dev` presente in quel branch.

Per Gradle il collegamento contiene directory relativa della build/wrapper e
percorso qualificato del task, per esempio `:app:test` in una build che lo espone.
La build Gradle e i suoi sottoprogetti hanno identità distinte dai package Node.

Il comando risolto e la directory sono consultabili prima dell'avvio. Parametri
aggiuntivi possono diventare preset distinti; non servono nel primo flusso base.

## UX proposta

1. Aggiungere il progetto e selezionare un worktree.
2. Vedere le cartelle già configurate e le sorgenti di task riconosciute.
3. Aprire l'elenco dei task di una sorgente; cercare per nome.
4. Usare una stella per rendere immediati i task frequenti.
5. Avviare un task dal preferito o dall'elenco completo.

Preferiti in vista principale; azione “Tutti i task” per gli altri. I task non
preferiti restano disponibili. Con zero preferiti, mostrare il percorso per
sceglierli, non una sezione senza spiegazione.

Nel monorepo mostrare sempre la cartella insieme al nome: `dev` della root e
`dev` di `services/call` sono due task diversi. Raggruppare per sorgente/cartella
e indicare npm/pnpm/yarn oppure Gradle. Per il primo incremento leggere root
e cartelle aggiunte dall'utente; evitare una scansione indiscriminata di copie
dei worktree, node_modules, directory di build o link simbolici.

## Preferiti personali e file condiviso

Confermato: preferiti personali **per progetto**,
riutilizzati in tutti i suoi worktree. La disponibilità e la definizione del
task sono invece lette nel worktree corrente.

La persistenza locale delle stelle resta la soluzione raccomandata.

Se lo script è assente in un branch, il preferito rimane visibile come non
disponibile. Se la cartella cambia nome, offrire una correzione esplicita;
non indovinare un altro task con lo stesso nome. Errori di discovery Gradle
significano disponibilità sconosciuta, non task inesistente.

Per iniziare nessun file obbligatorio nel repository. L'app può memorizzare
le preferenze in JSON internamente senza richiedere che l'utente lo modifichi.

Successivamente `.darsena.json` può condividere sorgenti, task consigliati,
etichette e comandi personalizzati. I task consigliati dal progetto rimangono
distinti dalle stelle personali: un file condiviso non deve riscrivere i
preferiti del singolo sviluppatore. Esportazione dalla UI con azione esplicita.

## Scoperta package.json

Leggere staticamente `scripts`, senza eseguire il progetto. Risolvere il package
manager in base alla configurazione del repository e consentire una correzione
locale quando ambiguo. Invocare lo script attraverso il package manager:
questo conserva il suo ambiente di esecuzione e i lifecycle hook applicabili.

Non eseguire gli script durante la discovery e non copiare la loro stringa nel
catalogo dei preferiti. Rileggere la sorgente quando cambia il worktree e prima
dell'avvio per evitare di usare una definizione appartenente a un'altra copia.

Fonte: [npm scripts](https://docs.npmjs.com/cli/using-npm/scripts/).

## Scoperta Gradle

Gradle supporta report tramite `./gradlew tasks` e `./gradlew tasks --all`,
anche per sottoprogetti, per esempio `./gradlew :app:tasks --all`. I task possono
essere aggiunti da plugin, quindi leggere soltanto build.gradle non è sufficiente.

Interfaccia proposta: riconoscere wrapper/build, mostrare “Carica task Gradle”,
poi cercare e preferire i task nello stesso modo degli script package.json.
Preferire il wrapper del progetto e mantenere il percorso qualificato dei task.

Il report richiede l'esecuzione di Gradle e la configurazione della build;
può richiedere Java, download e tempo. Non lanciarlo automaticamente per ogni
worktree al momento dell'aggiunta del progetto. Mostrare caricamento, errore e
aggiornamento esplicito; cache distinta per worktree/build e indicazione di
quando è stata ottenuta. Non presumere che il solo build.gradle catturi ogni
dipendenza che può cambiare l'elenco.

Un report testuale non è un'API JSON stabile. Prima di implementare la discovery
completa, validare una strategia sulle versioni Gradle supportate e sulla build
Android reale: report CLI delimitato e parsing con errori espliciti oppure un
report strutturato prodotto da un'integrazione dedicata. Nessuna discovery Gradle
è stata eseguita durante questa analisi.

Fonti: [Gradle task reports](https://docs.gradle.org/current/userguide/part2_gradle_tasks.html),
[Gradle multi-project configuration](https://docs.gradle.org/current/userguide/part3_multi_project_builds.html).

## Agnosticità e primo perimetro

Prevedere “Aggiungi comando personalizzato” con eseguibile, argomenti e cartella
per toolchain senza discovery dedicata. Questo rende possibile lavorare con
altre codebase senza promettere di individuare automaticamente ogni loro task.

Implementare prima discovery package.json, selezione/preferiti e avvio. Il
supporto all'esecuzione di un task Gradle come comando è più semplice della
discovery completa: i due livelli vanno dichiarati e pianificati separatamente.
Se la scelta visuale dei task Gradle è prioritaria, includere un adattatore
mirato come secondo caso concreto, prima di estendere ad altre toolchain.

## Esecuzione e conflitti tra worktree

Scelta confermata: runner interno dalla prima versione. Ogni esecuzione deve
conservare progetto, worktree, cartella, task, comando risolto, stato, log ed
esito; Start e Stop appartengono all'esecuzione, non al contesto attualmente
selezionato nella UI. Il riepilogo resta disponibile cambiando worktree.

Esigenza espressa: un server già in esecuzione nel worktree A può interferire
con il tentativo di avviarlo nel worktree B; bisogna identificare il detentore
e poterlo interrompere o gestire. Un nome di task uguale non prova un conflitto:
due istanze possono coesistere se usano risorse distinte.

Flusso proposto, ancora da discutere:

- Per una risorsa esclusiva nota, come porta locale o hostname, mostrare
  l'esecuzione che la occupa, il relativo worktree e le azioni disponibili.
- Se l'esecuzione è gestita, offrire Stop e un'eventuale azione esplicita
  “Ferma lì e avvia qui”; non trasferire processi selezionando un worktree.
- Un trasferimento ferma l'esecuzione, verifica la liberazione della risorsa,
  poi avvia la nuova. Un errore di avvio è mostrato come errore, non come
  trasferimento riuscito; ripristino automatico non è implicito.
- Per processi esterni distinguere conflitto rilevato da proprietà del
  processo: attribuire il worktree solo quando vi sono dati sufficienti;
  non promettere i log storici o il controllo di un task mai avviato da Darsena.
- Le risorse note possono provenire da impostazioni del task o integrazioni
  mirate. L'osservazione dopo l'avvio non garantisce di prevenire ogni conflitto
  prima dell'esecuzione; non dedurre porte certe da script arbitrari.

I servizi avviati da agenti, terminale o IDE sono un caso normale; l'utente
non può stimarne una frequenza fissa e non serve richiederla. Progettare la
segnalazione dei conflitti e l'attribuzione al worktree quando osservabile.
Non è stato approvato alcun comportamento di arresto automatico di processi esterni.

## Finestra e uscita dall'app

Comportamento confermato dall'utente:

- Chiudere la finestra lascia Darsena in background e i task in esecuzione.
- Riaprire la finestra mostra nuovamente lo stato e i log mantenuti dall'app.
- Esci arresta i task avviati da Darsena prima di terminare l'app.
- Nessuna impostazione per fermare i task alla semplice chiusura della finestra
  nella prima versione; non aggiungerla preventivamente.

Lo shutdown riguarda le esecuzioni gestite e i relativi figli controllabili;
i processi esterni riconosciuti non diventano automaticamente gestiti e non
vanno terminati all'uscita. Implementare uno stop con attesa limitata e rendere
visibili gli eventuali arresti falliti, senza promettere il controllo di daemon
condivisi che appartengono ad altri strumenti.
