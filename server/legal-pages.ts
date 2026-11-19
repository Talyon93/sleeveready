import type { LegalTextLanguage } from '../shared/legal.ts';
import { gameOnline } from '../shared/games.ts';

// Privacy notice and terms of use, in English and Italian. Controller and contact come from the environment
// (PUBLIC_PRIVACY_CONTROLLER, PUBLIC_PRIVACY_CONTACT_EMAIL) and arrive here already escaped.
export type LegalContext = { controller: string; email: string };
type LegalText = { title: string; switchLabel: string; body: (context: LegalContext) => string };

const updated = { en: 'Last updated: 7 October 2026', it: 'Ultimo aggiornamento: 7 ottobre 2026' };
// Riftbound is listed, with the notice Riot's policy requires, only while the game is on the site (shared/games.ts).
const riftbound = gameOnline('riftbound');
const riotNotice = riftbound
  ? `<p>SleeveReady was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.</p>`
  : '';
const mail = (email: string) => email.includes('@') ? `<a href="mailto:${email}">${email}</a>` : email;

export const privacyText: Record<LegalTextLanguage, LegalText> = {
  en: {
    title: 'Privacy notice',
    switchLabel: 'Leggi in italiano',
    body: ({ controller, email }) => `<h1>Privacy notice</h1><p>${updated.en}</p>
<p>This notice explains which personal data SleeveReady processes, why, and what rights you have under the EU General Data Protection Regulation (GDPR).</p>
<h2>1. Controller and contact</h2><p>The controller is ${controller}. For any privacy question or request: ${
  mail(email)
}.</p>
<h2>2. What we process</h2>
<h3>Browsing the site</h3><p>No account is needed to browse the catalogue, prepare a print sheet or print it. Like any website, the hosting provider (Netlify) processes your IP address, browser details and the pages requested in order to deliver the site and keep it secure; these technical logs are kept for the short period set by the hosting provider. To prevent abuse, the server also counts requests per IP address in memory for at most one minute; this count is never written to disk.</p>
<h3>Card images</h3><p>Card images are loaded by your browser directly from the servers of the catalogue providers credited on each game page (for example Scryfall, TCGdex, LorcanaJSON and Ravensburger, Riot Games, YGOPRODeck and the official websites of the publishers). Those providers therefore receive your IP address and browser details when an image is shown. One Piece and Cyberpunk images pass through our server, so those providers only see our server.</p>
<h3>Account (optional)</h3><p>If you create an account, we process your email address and the lists you save. Sign-in is provided by Supabase, either with a one-time link sent to your email or with Google. If you choose Google, Google authenticates you and shares your email address and name with us; Google's own privacy policy applies to that step.</p>
<h3>Anonymous print counts</h3><p>When you print a sheet, the cards on it (name, number, set and image address) are added to an anonymous count used for the public “most printed” rankings. No account, device, IP address or other personal data is stored with it, so these counts are not personal data.</p>
<h3>Anonymous visit counts</h3><p>To know which games and pages are used, the site adds one to a daily counter for each page opened, each sheet printed, each shop link clicked and the steps of a visit (adding a card, opening the preview, printing, importing or sharing a list). The counter stores only the page address, the website you came from (its name only), your browser's time zone and whether the screen is touch-first. To tell returning visitors from new ones, your browser keeps the date of your first visit (<code>sleeveready.firstVisit</code>) for up to 13 months; only “new” or “returning” is counted, never the date. No cookie, IP address or identifier is used, the counts are aggregated by day and cannot be linked to you. To stop being counted, open <a href="/?nostats=1">sleeveready.com/?nostats=1</a>.</p><h3>Shop links</h3><p>Card and expansion pages link to searches on Amazon, eBay, CardTrader and TCGplayer. Some are affiliate links. SleeveReady does not send these shops any personal data; once you open a shop, its own privacy policy and cookies apply, and it may tell us that a purchase came from our link, without identifying you.</p>
<h2>3. Legal bases</h2><ul><li>Account and saved lists: performance of the service you request (Art. 6(1)(b) GDPR).</li><li>Technical logs, abuse prevention and loading card images: our legitimate interest in providing a working and secure catalogue (Art. 6(1)(f) GDPR).</li></ul>
<h2>4. How long we keep data</h2><p>Technical logs: the few days set by the hosting provider. Account data and saved lists: until you delete them or ask us to delete your account. Data kept in your browser: until you clear it.</p>
<h2>5. Recipients and transfers outside the EU</h2><p>Netlify (hosting) and Supabase (accounts, saved lists and anonymous counts) process data on our behalf. Google is involved only if you sign in with Google. Some of these providers are based in the United States; transfers rely on the EU-US Data Privacy Framework or on the European Commission's standard contractual clauses, as applicable. Image providers receive the technical data described above.</p>
<h2>6. Children</h2><p>Accounts are for people aged 14 or over. Younger users can use the site without an account.</p>
<h2>7. Your rights</h2><p>You can ask for access, correction, deletion, restriction, portability, and object to processing based on legitimate interest, by writing to ${
  mail(email)
}. You can also lodge a complaint with your data-protection authority; in Italy, the Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it">garanteprivacy.it</a>).</p>
<h2>8. Cookies and browser storage</h2><p>SleeveReady uses no cookies, no advertising and no third-party trackers. It keeps in your browser only what the site needs to work, plus one date for its own anonymous statistics:</p><ul><li><code>sleeveready.language</code>: the chosen language;</li><li><code>sleeveready.tray.v1.*</code> and <code>sleeveready.print.v1</code>: your print sheet and print settings;</li><li><code>sb-*-auth-token</code>: your sign-in session, only if you sign in;</li><li><code>sleeveready.firstVisit</code>: the date of your first visit, for the anonymous visit counts (see section 2), kept up to 13 months;</li><li><code>sleeveready.noStats</code>: only on the devices of the people who run the site, so their own visits are not counted.</li></ul><p>The site's own storage is strictly necessary for features you request; the first-visit date only serves anonymous, aggregate audience measurement by the site itself, is never shared or combined with other data, and can be refused with <code>?nostats=1</code>. For this reason no consent banner is required. You can delete it at any time from your browser settings.</p>
<h2>9. Changes</h2><p>We will update this page if the processing changes; the date at the top shows the latest version.</p>`,
  },
  it: {
    title: 'Informativa sulla privacy',
    switchLabel: 'Read in English',
    body: ({ controller, email }) => `<h1>Informativa sulla privacy</h1><p>${updated.it}</p>
<p>Questa informativa spiega quali dati personali tratta SleeveReady, perché, e quali diritti hai secondo il Regolamento generale sulla protezione dei dati (GDPR).</p>
<h2>1. Titolare e contatti</h2><p>Il titolare del trattamento è ${controller}. Per qualsiasi domanda o richiesta sulla privacy: ${
  mail(email)
}.</p>
<h2>2. Quali dati trattiamo</h2>
<h3>Navigazione</h3><p>Per consultare il catalogo, preparare un foglio e stamparlo non serve un account. Come per ogni sito, il fornitore di hosting (Netlify) tratta il tuo indirizzo IP, i dati del browser e le pagine richieste per erogare il sito e proteggerlo; questi log tecnici sono conservati per il breve periodo previsto dal fornitore. Per prevenire abusi, il server conta inoltre in memoria le richieste per indirizzo IP per al massimo un minuto, senza mai salvarle.</p>
<h3>Immagini delle carte</h3><p>Le immagini delle carte vengono caricate dal tuo browser direttamente dai server dei fornitori di catalogo indicati in ogni pagina di gioco (ad esempio Scryfall, TCGdex, LorcanaJSON e Ravensburger, Riot Games, YGOPRODeck e i siti ufficiali degli editori). Questi fornitori ricevono quindi il tuo indirizzo IP e i dati del browser quando un'immagine viene mostrata. Le immagini di One Piece e Cyberpunk passano dal nostro server, quindi quei fornitori vedono solo il nostro server.</p>
<h3>Account (facoltativo)</h3><p>Se crei un account trattiamo il tuo indirizzo email e le liste che salvi. L'accesso è gestito da Supabase, con un link monouso inviato alla tua email oppure con Google. Se scegli Google, è Google ad autenticarti e a comunicarci email e nome; per quel passaggio vale l'informativa di Google.</p>
<h3>Conteggi anonimi delle stampe</h3><p>Quando stampi un foglio, le carte che contiene (nome, numero, set e indirizzo dell'immagine) si aggiungono a un conteggio anonimo usato per le classifiche pubbliche delle carte più stampate. Non vengono salvati account, dispositivo, indirizzo IP o altri dati personali: questi conteggi non sono dati personali.</p>
<h3>Conteggi anonimi delle visite</h3><p>Per sapere quali giochi e pagine vengono usati, il sito aggiunge uno a un contatore giornaliero per ogni pagina aperta, foglio stampato, link a un negozio cliccato e per i passaggi di una visita (aggiungere una carta, aprire l'anteprima, stampare, importare o condividere una lista). Il contatore conserva solo l'indirizzo della pagina, il sito da cui arrivi (solo il nome), il fuso orario del browser e se lo schermo è touch. Per distinguere chi torna da chi arriva per la prima volta, il browser conserva la data della prima visita (<code>sleeveready.firstVisit</code>) per al massimo 13 mesi; viene contato solo “nuovo” o “di ritorno”, mai la data. Non usa cookie, indirizzi IP o identificativi: i conteggi sono aggregati per giorno e non sono collegabili a te. Per non essere contato apri <a href="/?nostats=1">sleeveready.com/?nostats=1</a>.</p><h3>Link ai negozi</h3><p>Le pagine di carte ed espansioni rimandano a ricerche su Amazon, eBay, CardTrader e TCGplayer. Alcuni sono link affiliati. SleeveReady non invia dati personali a questi negozi; quando apri un negozio valgono la sua informativa e i suoi cookie, e il negozio può comunicarci che un acquisto è arrivato dal nostro link, senza identificarti.</p>
<h2>3. Basi giuridiche</h2><ul><li>Account e liste salvate: esecuzione del servizio che richiedi (art. 6, par. 1, lett. b GDPR).</li><li>Log tecnici, prevenzione degli abusi e caricamento delle immagini: nostro legittimo interesse a offrire un catalogo funzionante e sicuro (art. 6, par. 1, lett. f GDPR).</li></ul>
<h2>4. Per quanto tempo</h2><p>Log tecnici: i pochi giorni previsti dal fornitore di hosting. Dati dell'account e liste salvate: finché non li elimini o ci chiedi di cancellare l'account. Dati nel browser: finché non li cancelli.</p>
<h2>5. Destinatari e trasferimenti fuori dall'UE</h2><p>Netlify (hosting) e Supabase (account, liste salvate e conteggi anonimi) trattano dati per nostro conto. Google interviene solo se accedi con Google. Alcuni di questi fornitori hanno sede negli Stati Uniti; i trasferimenti si basano sul Data Privacy Framework UE-USA o sulle clausole contrattuali standard della Commissione europea, a seconda del caso. I fornitori delle immagini ricevono i dati tecnici descritti sopra.</p>
<h2>6. Minori</h2><p>Gli account sono riservati a chi ha almeno 14 anni. Chi è più giovane può usare il sito senza account.</p>
<h2>7. I tuoi diritti</h2><p>Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opporti ai trattamenti basati sul legittimo interesse scrivendo a ${
  mail(email)
}. Puoi anche proporre reclamo al Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it">garanteprivacy.it</a>) o all'autorità del tuo Paese.</p>
<h2>8. Cookie e memoria del browser</h2><p>SleeveReady non usa cookie, pubblicità né strumenti di tracciamento di terzi. Conserva nel tuo browser solo ciò che serve al funzionamento del sito, più una data per le proprie statistiche anonime:</p><ul><li><code>sleeveready.language</code>: la lingua scelta;</li><li><code>sleeveready.tray.v1.*</code> e <code>sleeveready.print.v1</code>: il foglio di stampa e le impostazioni di stampa;</li><li><code>sb-*-auth-token</code>: la sessione di accesso, solo se accedi;</li><li><code>sleeveready.firstVisit</code>: la data della prima visita, per i conteggi anonimi delle visite (vedi la sezione 2), conservata al massimo 13 mesi;</li><li><code>sleeveready.noStats</code>: solo sui dispositivi di chi gestisce il sito, per non contarne le visite.</li></ul><p>La memoria del sito è strettamente necessaria alle funzioni che richiedi; la data della prima visita serve solo a una misurazione anonima e aggregata del pubblico fatta dal sito stesso, non viene mai condivisa né incrociata con altri dati e si può rifiutare con <code>?nostats=1</code>. Per questo non serve un banner di consenso. Puoi cancellarli in qualsiasi momento dalle impostazioni del browser.</p>
<h2>9. Modifiche</h2><p>Aggiorneremo questa pagina se il trattamento cambia; la data in alto indica la versione più recente.</p>`,
  },
};

export const termsText: Record<LegalTextLanguage, LegalText> = {
  en: {
    title: 'Terms of use',
    switchLabel: 'Leggi in italiano',
    body: ({ controller, email }) => `<h1>Terms of use</h1><p>${updated.en}</p>
<h2>1. The service</h2><p>SleeveReady, operated by ${controller}, lets you browse trading-card catalogue data and prepare sheets of card images to print for personal playtesting. The service is free and needs no account; an optional account lets you save lists.</p>
<h2>2. Permitted use</h2><p>Printed sheets are for personal, non-commercial playtesting only. You must not sell them, distribute them, use them in sanctioned tournaments where proxies are not allowed, or present them as original cards. You must not overload the service, bypass its limits, scrape it or interfere with other users.</p>
<h2>3. Intellectual property and removal requests</h2><p>SleeveReady is an unofficial fan project. It is not affiliated with, endorsed, sponsored or approved by Wizards of the Coast, The Pokémon Company, Bandai, Ravensburger, Disney, Riot Games, Konami, Fantasy Flight Games, Legend Story Studios, Bushiroad, Erik’s Curiosa, Pocketpair, CD PROJEKT or any other publisher. Cards, artwork, names and trademarks belong to their respective owners. If you hold rights in content shown on SleeveReady and want it removed, write to ${
  mail(email)
} with the pages concerned and the rights involved: we review every request promptly and remove the content when the request is well founded.</p>
<h2>4. Third-party data</h2><p>Catalogue data and images come from external providers, including Scryfall for Magic, TCGdex for Pokémon, the official Bandai card list for One Piece${
  riftbound ? ', LorcanaJSON for Lorcana and the Riot Games API for Riftbound' : ' and LorcanaJSON for Lorcana'
}, and may be incomplete, delayed or unavailable.</p>${riotNotice}
<h2>5. Shop and affiliate links</h2><p>Links to Amazon, eBay, CardTrader and TCGplayer may be affiliate links: if you buy after following one, SleeveReady may earn a commission at no extra cost to you. As an Amazon Associate, SleeveReady earns from qualifying purchases. SleeveReady does not sell cards; prices, availability and sales are the shops' responsibility.</p>
<h2>6. Accounts</h2><p>Accounts are for people aged 14 or over. You are responsible for access to your email or Google account. You can delete your saved lists at any time and ask for your account to be deleted at ${
  mail(email)
}.</p>
<h2>7. Availability and liability</h2><p>The service is provided as available and may change or stop. To the extent permitted by law, we are not liable for losses arising from unavailable or inaccurate third-party data or from the use of unofficial playtest material. Nothing in these terms limits rights you have as a consumer.</p>
<h2>8. Changes and applicable law</h2><p>We may update these terms; the date at the top shows the latest version. These terms are governed by Italian law, without prejudice to the mandatory consumer protections of your country of residence.</p>
<h2>9. Contact</h2><p>${mail(email)}</p>`,
  },
  it: {
    title: 'Termini di utilizzo',
    switchLabel: 'Read in English',
    body: ({ controller, email }) => `<h1>Termini di utilizzo</h1><p>${updated.it}</p>
<h2>1. Il servizio</h2><p>SleeveReady, gestito da ${controller}, ti permette di consultare dati di catalogo di giochi di carte collezionabili e di preparare fogli di immagini da stampare per il playtest personale. Il servizio è gratuito e non richiede account; un account facoltativo permette di salvare le liste.</p>
<h2>2. Uso consentito</h2><p>I fogli stampati servono solo per il playtest personale e non commerciale. Non puoi venderli, distribuirli, usarli in tornei ufficiali dove i proxy non sono ammessi o spacciarli per carte originali. Non puoi sovraccaricare il servizio, aggirarne i limiti, estrarne i dati in modo automatico o disturbare gli altri utenti.</p>
<h2>3. Proprietà intellettuale e richieste di rimozione</h2><p>SleeveReady è un progetto non ufficiale di appassionati. Non è affiliato, approvato, sponsorizzato né autorizzato da Wizards of the Coast, The Pokémon Company, Bandai, Ravensburger, Disney, Riot Games, Konami, Fantasy Flight Games, Legend Story Studios, Bushiroad, Erik’s Curiosa, Pocketpair, CD PROJEKT o altri editori. Carte, illustrazioni, nomi e marchi appartengono ai rispettivi titolari. Se sei titolare di diritti su contenuti mostrati da SleeveReady e vuoi che vengano rimossi, scrivi a ${
  mail(email)
} indicando le pagine e i diritti in questione: esaminiamo ogni richiesta rapidamente e rimuoviamo i contenuti quando la richiesta è fondata.</p>
<h2>4. Dati di terze parti</h2><p>Dati e immagini del catalogo provengono da fornitori esterni, tra cui Scryfall per Magic, TCGdex per Pokémon, la card list ufficiale Bandai per One Piece${
  riftbound ? ", LorcanaJSON per Lorcana e l'API di Riot Games per Riftbound" : ' e LorcanaJSON per Lorcana'
}, e possono essere incompleti, in ritardo o non disponibili.</p>${riotNotice}
<h2>5. Negozi e link affiliati</h2><p>I link ad Amazon, eBay, CardTrader e TCGplayer possono essere link affiliati: se acquisti dopo averne seguito uno, SleeveReady può ricevere una commissione senza costi aggiuntivi per te. In qualità di Affiliato Amazon, SleeveReady riceve un guadagno dagli acquisti idonei. SleeveReady non vende carte; prezzi, disponibilità e vendite sono responsabilità dei negozi.</p>
<h2>6. Account</h2><p>Gli account sono riservati a chi ha almeno 14 anni. Sei responsabile dell'accesso alla tua email o al tuo account Google. Puoi eliminare le liste salvate in qualsiasi momento e chiedere la cancellazione dell'account scrivendo a ${
  mail(email)
}.</p>
<h2>7. Disponibilità e responsabilità</h2><p>Il servizio è offerto così com'è e può cambiare o interrompersi. Nei limiti consentiti dalla legge, non rispondiamo di danni dovuti a dati di terze parti non disponibili o inesatti o all'uso di materiale non ufficiale per il playtest. Nulla in questi termini limita i diritti che hai come consumatore.</p>
<h2>8. Modifiche e legge applicabile</h2><p>Possiamo aggiornare questi termini; la data in alto indica la versione più recente. I termini sono regolati dalla legge italiana, fatte salve le tutele inderogabili per i consumatori del Paese in cui risiedi.</p>
<h2>9. Contatti</h2><p>${mail(email)}</p>`,
  },
};
