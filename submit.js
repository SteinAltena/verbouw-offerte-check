// /api/submit.js
// Vercel serverless function (Node.js runtime)
//
// Ontvangt: klantgegevens + 1-3 offertes (als base64) in JSON.
// Doet: stuurt de offerte(s) naar de Claude API voor analyse,
//       mailt het rapport naar de klant + een kopie naar de ondernemer.
//
// Vereiste environment variables (in te stellen in Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY   — van console.anthropic.com
//   RESEND_API_KEY      — van resend.com
//   NOTIFY_EMAIL        — jouw eigen e-mailadres, ontvangt een kopie van elke aanvraag
//   FROM_EMAIL          — verzendadres, bv. rapport@deverbouwoffertecheck.nl (moet geverifieerd zijn bij Resend)

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb', // ruimte voor 1-3 gescande offertes
    },
  },
};

const ANALYSIS_SYSTEM_PROMPT = `Je bent een ervaren bouwkundig adviseur die verbouwingsoffertes voor particulieren beoordeelt.
Je krijgt 1 tot 3 offertes voor een verbouwing aan een bestaande woning.

Beoordeel elke offerte op:
- volledigheid (sloopwerk, afvalafvoer, herstelwerk, afwerking, elektra, planning, garantie, meerwerk)
- duidelijkheid van de omschrijving en de posten
- risico's die horen bij bestaande woningen (verborgen gebreken, asbest, leidingwerk, constructie)
- prijsopbouw: stelposten, btw, betalingstermijnen

Schrijf een praktisch rapport in gewone taal (geen bouwjargon), met per offerte:
1. Een score op duidelijkheid en volledigheid (1-10)
2. Rode vlaggen
3. Ontbrekende of onduidelijke posten
4. Concrete vragen om aan de aannemer te stellen

Sluit af met een vergelijking (als er meerdere offertes zijn) en een praktisch eindadvies: tekenen, doorvragen, of extra offerte aanvragen.

Belangrijk: dit is een praktische analyse, geen bouwkundige keuring of juridisch advies. Vermeld dat kort aan het eind.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Alleen POST toegestaan' });
  }

  try {
    const {
      naam, email, telefoon, type, regio,
      omschrijving, twijfel, start, pakket,
      offertes, // array van { filename, mediaType, base64 }
    } = req.body;

    if (!naam || !email || !offertes || !offertes.length) {
      return res.status(400).json({ error: 'Ontbrekende velden: naam, email en minimaal 1 offerte zijn verplicht.' });
    }

    // 1) Bouw het bericht voor Claude: context + de offerte-documenten
    const contextText = `Klantgegevens:
- Type verbouwing: ${type || 'onbekend'}
- Regio: ${regio || 'onbekend'}
- Omschrijving: ${omschrijving || 'geen omschrijving opgegeven'}
- Grootste twijfel: ${twijfel || 'niet opgegeven'}
- Gewenste startdatum: ${start || 'niet opgegeven'}
- Gekozen pakket: ${pakket || 'onbekend'}

Analyseer de bijgevoegde offerte(s) volgens de instructies.`;

    const content = [{ type: 'text', text: contextText }];
    for (const offerte of offertes) {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: offerte.mediaType || 'application/pdf',
          data: offerte.base64,
        },
      });
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('Claude API error:', errText);
      return res.status(502).json({ error: 'Analyse is mislukt, probeer het later opnieuw.' });
    }

    const claudeData = await claudeResponse.json();
    const reportText = claudeData.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');

    // 2) Rapport mailen naar de klant
    await sendEmail({
      to: email,
      subject: 'Je offerte-analyse is klaar — De Verbouw Offerte Check',
      html: renderReportEmail(naam, reportText),
    });

    // 3) Kopie naar de ondernemer, zodat je meekijkt
    if (process.env.NOTIFY_EMAIL) {
      await sendEmail({
        to: process.env.NOTIFY_EMAIL,
        subject: `Nieuwe aanvraag: ${naam} (${pakket || 'pakket onbekend'})`,
        html: `<p>Nieuwe aanvraag ontvangen.</p><pre>${escapeHtml(contextText)}</pre><hr><pre>${escapeHtml(reportText)}</pre>`,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Onverwachte fout in /api/submit:', err);
    return res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw of neem contact op.' });
  }
}

async function sendEmail({ to, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error('Resend error:', errText);
  }
}

function renderReportEmail(naam, reportText) {
  const bodyHtml = escapeHtml(reportText).replace(/\n/g, '<br>');
  return `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width:600px; margin:0 auto; color:#1E2226;">
      <h2>Je offerte-analyse</h2>
      <p>Beste ${escapeHtml(naam)},</p>
      <p>Hieronder de analyse van je offerte(s).</p>
      <div style="background:#F7F6F2; border:1px solid #DFDCD2; border-radius:10px; padding:20px; margin:20px 0;">
        ${bodyHtml}
      </div>
      <p style="color:#8B9096; font-size:13px;">Dit rapport is een praktische analyse, geen bouwkundige keuring of juridisch advies.</p>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
