# Visibilita delle richieste per stato

Questo documento descrive cosa appare nelle aree personali per ciascuno dei sette stati della richiesta di ritiro.

Ogni richiesta ha un codice univoco, generato automaticamente e distinto dal codice CER (ad esempio `WM-2026-A7K2P9`). Il codice identifica la richiesta nelle liste, nei dettagli e nella pianificazione; il CER continua a identificare il tipo di rifiuto.

## Come leggere gli stati

Lo stato ufficiale della richiesta e mostrato al produttore. Destinatari e trasportatori vedono invece una fase personale (`stage`): dipende anche dalla loro risposta e dal fatto che il produttore abbia selezionato il loro pacchetto. Di conseguenza, la stessa richiesta puo avere una fase diversa nell'area dei diversi operatori.

Destinatari e trasportatori non vedono tutte le richieste della piattaforma: vedono solo quelle per cui hanno ricevuto un invito. Il destinatario vede la propria disponibilita e il proprio prezzo; il trasportatore vede la propria proposta. Non vedono le offerte degli altri operatori ne' il budget massimo del produttore.

Nel dettaglio del produttore, i nomi dei destinatari e dei trasportatori disponibili restano nascosti durante la raccolta delle risposte e il confronto dei pacchetti. I nomi delle parti del pacchetto selezionato vengono mostrati quando si apre l'accordo, per permettere di concordare il ritiro.

| Stato della richiesta | Produttore | Destinatario invitato | Trasportatore invitato | Amministratore |
|---|---|---|---|---|
| `draft` — Bozza | La vede in **Le mie richieste** e nel dettaglio. Può modificarla, pubblicarla se il codice CER è noto oppure annullarla. Se il CER non è noto, il dettaglio segnala che è in attesa dell'amministratore. | Non la vede: non è ancora stata pubblicata né inviata agli operatori. | Non la vede: non è ancora stata pubblicata né inviata agli operatori. | La vede in **Compliance > Riconoscimento CER** solo se il codice CER non è noto. Dopo aver proposto un codice, la richiesta resta bozza ma scompare da quella coda. |
| `awaiting_recipients` — In attesa dei destinatari | Vede disponibilità, prezzi e risposte, ma non i nomi dei destinatari. Può chiudere la raccolta e avvisare i trasportatori solo se almeno un destinatario è disponibile; può anche annullare la richiesta. | Se invitato, la vede tra le richieste ricevute. Se deve ancora rispondere, la fase è **Da rispondere**; può indicare la disponibilità e il prezzo oppure non essere disponibile. Può aggiornare la risposta finché la raccolta è aperta. | Non la vede ancora: i trasportatori vengono invitati dopo la chiusura della raccolta destinatari, se c'è almeno una disponibilità. | Non ha una vista operativa di questo stato. |
| `awaiting_transporters` — In attesa dei trasportatori | Vede le risposte dei destinatari e le proposte ricevute, ma non i nomi delle altre aziende. Può chiudere l'asta e generare i pacchetti se è arrivata almeno una proposta; può anche annullare la richiesta. | Se invitato, la richiesta resta nell'elenco: la propria risposta appare come inviata/in attesa o conclusa, secondo l'esito. Non può più modificare la disponibilità. | Se invitato e non ha ancora risposto, la vede tra le richieste **Da rispondere**. Può inviare/aggiornare una proposta o indicare che non partecipa mentre l'asta è aperta. Le proposte sono visibili al produttore, non agli altri operatori. | Non ha una vista operativa di questo stato. |
| `packages_ready` — Pacchetti pronti | Vede i pacchetti ordinati per prezzo con le identità delle altre aziende nascoste, e può selezionarne uno. Inizialmente sono mostrati fino a cinque pacchetti; altri possono comparire se quelli disponibili non vanno a buon fine. Può vedere i pacchetti non riusciti e annullare la richiesta. | Se invitato, vede la propria richiesta e la propria risposta; la fase è normalmente **In attesa**. Non vede i pacchetti concorrenti né può intervenire sulla scelta. | Se invitato, vede la propria richiesta e la propria proposta; la fase è normalmente **In attesa**. Non vede i pacchetti concorrenti né può intervenire sulla scelta. | Non ha una vista operativa di questo stato. |
| `in_agreement` — In accordo | Vede il pacchetto scelto, le parti coinvolte e il pannello per concordare giorno e ora. Può proporre la prima data, accettare quella attiva, proporre un'alternativa o ritirare la selezione; può annullare la richiesta. | Se è il destinatario del pacchetto selezionato, vede l'accordo, la data proposta e le accettazioni delle parti. Quando c'è una data attiva, può accettarla o proporre un'alternativa; può rinunciare al ritiro. Se non è stato selezionato, non vede i dettagli dell'accordo. | Se è il trasportatore del pacchetto selezionato, vede l'accordo, la data proposta e le accettazioni delle parti. Quando c'è una data attiva, può accettarla o proporre un'alternativa; può rinunciare al ritiro. Se non è stato selezionato, non vede i dettagli dell'accordo. | Non ha una vista operativa di questo stato. |
| `confirmed` — Confermata | Vede il ritiro confermato, la data e l'ora concordate, il pacchetto scelto e la cronologia. La richiesta resta nel dashboard tra quelle confermate; può ancora annullarla. | Il destinatario selezionato vede il ritiro confermato e la data concordata; compare tra gli arrivi, nel calendario e nei corrispettivi. Gli altri destinatari invitati vedono la partecipazione come conclusa. | Il trasportatore selezionato vede il ritiro confermato e la data concordata; compare tra i lavori assegnati, nella pianificazione e nei corrispettivi. Gli altri trasportatori invitati vedono la partecipazione come conclusa. | Vede solo il totale aggregato degli ordini nelle Analytics, non il dettaglio della richiesta in base a questo stato. |
| `cancelled` — Annullata | Vede la richiesta annullata, il motivo e la cronologia; non può compiere altre azioni sulla richiesta. | Se era stato invitato, vede la fase **Annullata** e l'avviso che non sono necessarie altre risposte. Non può più rispondere. | Se era stato invitato, vede la fase **Annullata** e l'avviso che non sono necessarie altre risposte. Non può più rispondere. | Non ha una vista operativa generale; se il CER non è noto, la richiesta può ancora comparire nella coda di riconoscimento CER. |

## Fasi personali di destinatario e trasportatore

Nel badge delle aree operatore non viene mostrato sempre lo stato generale della richiesta. Le fasi personali più comuni sono:

- `to_respond` — **Da rispondere**: c'è un invito ancora aperto.
- `responded` — **Risposta inviata**: l'operatore ha risposto mentre la raccolta è ancora aperta.
- `waiting` — **In attesa**: la propria risposta è stata registrata e il flusso prosegue, ma l'operatore non è stato selezionato per l'accordo.
- `in_agreement` — **Accordo su data e ora**: l'operatore è stato selezionato e partecipa alla negoziazione.
- `confirmed` — **Ritiro confermato**: l'operatore selezionato ha un ritiro confermato.
- `closed` — **Partecipazione conclusa**: l'operatore non è stato selezionato, ha rifiutato o non ha risposto entro il termine.
- `cancelled` — **Annullata**: la richiesta è stata annullata.

Le liste operatori permettono di filtrare le richieste da rispondere, quelle con risposta inviata/in attesa, gli accordi o ritiri confermati e le partecipazioni concluse/annullate. Dashboard, arrivi del destinatario e lavori assegnati del trasportatore evidenziano invece le fasi più rilevanti per l'azione corrente.

## Note sul dashboard del produttore

Il filtro **Puoi agire** dipende dai dati della richiesta, non solo dal suo stato:

- una bozza è azionabile se il CER è noto;
- durante la raccolta destinatari è azionabile se almeno un destinatario è disponibile;
- durante l'asta è azionabile se è arrivata almeno una proposta di trasporto;
- con i pacchetti pronti è azionabile la scelta del pacchetto;
- durante l'accordo è azionabile quando il produttore deve intervenire.

L'amministratore non dispone di una schermata per seguire tutte le richieste stato per stato: l'intervento specifico sulle richieste riguarda la coda di riconoscimento CER, filtrata per CER non noto e non per stato della richiesta. Per questo, una bozza annullata con CER ancora ignoto può comparire in quella coda. Le Analytics mostrano il totale aggregato degli ordini, non il dettaglio per stato.

## Riferimenti all'implementazione

- Stati e transizioni: `server/src/config/pickupFlow.js`.
- Visibilità e fasi per ruolo: `server/src/services/pickupViews.js`.
- Dashboard e dettaglio produttore: `client/src/pages/producer/ProducerDashboard.jsx`, `client/src/pages/producer/ProducerPickupPage.jsx`.
- Dashboard e liste operatori: `client/src/pages/recipient/RecipientDashboard.jsx`, `client/src/pages/transporter/TransporterDashboard.jsx`, `client/src/components/shared/AgreementList.jsx`.
- Etichette e filtri: `client/src/services/labels.js`, `client/src/services/pickupGuidance.js`.
- Coda amministrativa CER e Analytics: `client/src/pages/admin/AdminCompliancePage.jsx`, `client/src/pages/admin/AdminAnalyticsPage.jsx`.
