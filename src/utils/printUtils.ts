/**
 * Utilitaire d'impression et d'export PDF ultra-compatible Safari (iOS & macOS).
 * Résout définitivement le problème du bloqueur de fenêtres pop-up de Safari :
 * 1. Pré-ouverture synchrone lors de l'événement clic de l'utilisateur (autorisée par Safari)
 * 2. Navigation vers un Blob URL HTML local (indépendant des blocages de pop-up tiers)
 * 3. Repli automatique par <iframe> invisible en cas de blocage strict (zéro fenêtre pop-up requise)
 */

export const createPrintWindow = (): Window | null => {
  try {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
          <head>
            <meta charset="utf-8">
            <title>DMK Système • Préparation...</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background-color: #f8fafc;
                color: #0f172a;
                text-align: center;
                padding: 20px;
                box-sizing: border-box;
              }
              .loader {
                width: 44px;
                height: 44px;
                border: 3.5px solid #cbd5e1;
                border-top-color: #2563eb;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-bottom: 16px;
              }
              @keyframes spin { to { transform: rotate(360deg); } }
              h3 { margin: 0 0 6px 0; font-size: 17px; font-weight: 800; color: #1e3a8a; }
              p { margin: 0; font-size: 13px; color: #64748b; font-weight: 500; }
            </style>
          </head>
          <body>
            <div class="loader"></div>
            <h3>Génération du document officiel DMK...</h3>
            <p>Mise en page du rapport en cours, veuillez patienter...</p>
          </body>
        </html>
      `);
      w.document.close();
    }
    return w;
  } catch (err) {
    console.warn("Pré-ouverture de fenêtre pop-up ignorée:", err);
    return null;
  }
};

export const printDocument = (htmlContent: string, targetWindow?: Window | null): void => {
  // Injection d'une barre d'action mobile avec bouton d'impression direct
  const enrichedHtml = htmlContent.replace(
    '<body>',
    `<body>
      <div class="no-print" style="position: sticky; top: 0; left: 0; right: 0; background: #1e293b; color: white; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; z-index: 9999; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); font-family: -apple-system, sans-serif;">
        <span style="font-size: 12px; font-weight: 700; letter-spacing: 0.3px;">Rapport DMK prêt</span>
        <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-weight: bold; font-size: 12px; cursor: pointer;">
          🖨️ Imprimer / PDF
        </button>
      </div>`
  ).replace(
    '</style>',
    `  @media print { .no-print { display: none !important; } }
    </style>`
  );

  const blob = new Blob([enrichedHtml], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  // Cas 1 : Fenêtre pré-ouverte de manière synchrone lors du clic utilisateur
  if (targetWindow && !targetWindow.closed) {
    try {
      targetWindow.location.href = blobUrl;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    } catch (e) {
      console.warn("Échec redirection fenêtre pré-ouverte, bascule sur iframe:", e);
    }
  }

  // Cas 2 : Contournement sans pop-up par iframe invisible (Zéro pop-up requis)
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error("Erreur iframe print:", err);
          window.open(blobUrl, '_blank');
        }
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          URL.revokeObjectURL(blobUrl);
        }, 10000);
      }, 400);
    };
    return;
  } catch (err) {
    console.error("Erreur création iframe fallback:", err);
  }

  // Cas 3 : Dernier recours
  try {
    window.open(blobUrl, '_blank');
  } catch {
    window.print();
  }
};
