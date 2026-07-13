# De Verbouw Offerte Check — live-zetten

Alles staat klaar. Volg deze stappen in volgorde.

## 1. Domein
Koop je domein bij TransIP of Vimexx (al gedaan? ga naar stap 2).

## 2. Resend (transactionele e-mail)
1. Ga naar https://resend.com en maak een gratis account.
2. Voeg je domein toe (Domains -> Add Domain) en zet de gevraagde DNS-records
   (SPF/DKIM) bij je domeinregistrar. Dit is nodig zodat je mails niet in spam
   belanden.
3. Maak een API key aan (API Keys -> Create). Bewaar deze.
4. Kies een verzendadres, bv. `rapport@jouwdomein.nl`.

## 3. Anthropic API key
1. Ga naar https://console.anthropic.com -> API Keys -> Create Key.
2. Bewaar deze key. Zet er eventueel een uitgavenlimiet op
   (Settings -> Billing -> Limits) zodat je niet voor verrassingen komt te staan.

## 4. Mollie Payment Links
1. Log in op je Mollie-dashboard.
2. Ga naar Payment Links -> Nieuwe link, en maak er 3:
   - Basis-check — EUR 39
   - Vergelijk-check — EUR 69
   - Expert-check — EUR 179
3. Bij elke link kun je een "redirect URL" instellen — zet die op:
   - `https://jouwdomein.nl/#upload?pakket=basis`
   - `https://jouwdomein.nl/#upload?pakket=vergelijk`
   - `https://jouwdomein.nl/#upload?pakket=expert`
4. Kopieer de 3 gegenereerde betaal-links.
5. Open `index.html` en vervang de 3 placeholder-links (zoek op `TODO-VERVANG`)
   door jouw eigen Mollie-links.

## 5. Deployen naar Vercel
1. Zet deze projectmap in een GitHub-repository (of sleep de map direct in
   het Vercel-dashboard onder "Add New Project" -> "Deploy").
2. In Vercel: Project -> Settings -> Environment Variables, voeg toe:
   - `ANTHROPIC_API_KEY`
   - `RESEND_API_KEY`
   - `FROM_EMAIL`
   - `NOTIFY_EMAIL` (jouw eigen e-mailadres, voor een kopie van elke aanvraag)
3. Project -> Settings -> Domains: voeg je eigen domeinnaam toe en volg de
   DNS-instructies (meestal een simpele CNAME/A-record bij je registrar).
4. Deploy.

## Belangrijk om te weten (v1-beperkingen)
- De site controleert nu niet automatisch of er echt betaald is voordat het
  formulier verwerkt wordt — de betaling en de upload zijn twee losse stappen.
  Voor een eerste live-versie is dat werkbaar; wil je dit waterdicht maken,
  dan koppelen we later Mollie's Payment API + webhook eraan zodat de
  uploadfunctie alleen werkt na bevestigde betaling.
- Bestanden worden niet opgeslagen, alleen naar Claude gestuurd voor analyse
  en daarna weggegooid. Wil je een archief van aanvragen, dan voegen we later
  opslag toe (bv. Vercel Blob of Supabase).
- Grote scans (>10MB) kunnen mislukken door de request-limiet. Vraag klanten
  zo nodig om een PDF in plaats van foto's.

## Testen voordat je live gaat
Vraag jezelf (of een vriend) een test-offerte te uploaden via het formulier
en controleer of het rapport binnenkomt. Test ook een proefbetaling in Mollie
(er is een testmodus in het dashboard).
