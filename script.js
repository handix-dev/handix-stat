/*
 * ============================================================
 * CONFIGURATION & ÉLÉMENTS
 * ============================================================
 */
const WORKER_URL = "https://silent-salad-f4a2.handix-officiel.workers.dev/";

const input = document.getElementById("matchUrl");
const button = document.getElementById("analyser");
const status = document.getElementById("status");
const resultats = document.getElementById("resultats");
const debug = document.getElementById("debug");

function afficherStatus(message, type = "") {
  status.className = "";
  status.innerHTML = "";

  if (!type) return;

  if (type === "loading") {
    status.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <div>${message}</div>
      </div>
    `;
  } else if (type === "error") {
    status.innerHTML = `
      <div class="error-message">
        <i class="ri-error-warning-line" style="font-size: 24px; display: block; margin-bottom: 6px;"></i>
        <div>${message}</div>
      </div>
    `;
  } else if (type === "success") {
    status.innerHTML = `
      <div class="success-message">
        <i class="ri-checkbox-circle-line" style="margin-right: 6px;"></i>${message}
      </div>
    `;
  }
}

function verifierUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "www.ffhandball.fr" || parsed.hostname === "ffhandball.fr";
  } catch {
    return false;
  }
}

/*
 * ============================================================
 * EXTRACTION DES DONNÉES
 * ============================================================
 */
function extraireDonnees(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const joueursComponent = doc.querySelector(
    'smartfire-component[name="competitions---rencontre-liste-joueurs"]'
  );

  if (!joueursComponent) {
    throw new Error("Le composant des statistiques joueurs est introuvable sur la page.");
  }

  let attributesJoueurs = joueursComponent.getAttribute("attributes");
  if (!attributesJoueurs) throw new Error("Les données du match sont vides.");

  const textareaJoueurs = document.createElement("textarea");
  textareaJoueurs.innerHTML = attributesJoueurs;
  attributesJoueurs = textareaJoueurs.value;

  let joueursData;
  try {
    joueursData = JSON.parse(attributesJoueurs);
  } catch (error) {
    throw new Error("Impossible d'analyser le format JSON des joueurs.");
  }

  const scoreComponent = doc.querySelector(
    'smartfire-component[name="competitions---competition-score"]'
  );

  let scoreData = null;
  if (scoreComponent) {
    let attributesScore = scoreComponent.getAttribute("attributes");
    if (attributesScore) {
      const textareaScore = document.createElement("textarea");
      textareaScore.innerHTML = attributesScore;
      try {
        scoreData = JSON.parse(textareaScore.value);
      } catch (error) {
        console.warn("Impossible de lire les données du composant score.", error);
      }
    }
  }

  const rematchComponent = doc.querySelector(
    'smartfire-component[name="competitions---rematch"]'
  );

  let rematchData = null;
  if (rematchComponent) {
    let attributesRematch = rematchComponent.getAttribute("attributes");
    if (attributesRematch) {
      const textareaRematch = document.createElement("textarea");
      textareaRematch.innerHTML = attributesRematch;
      try {
        rematchData = JSON.parse(textareaRematch.value);
      } catch (error) {
        console.warn("Impossible de lire les données du composant rematch.", error);
      }
    }
  }

  return {
    ...joueursData,
    score: scoreData,
    rematch: rematchData
  };
}

/*
 * ============================================================
 * RENDU D'UNE ÉQUIPE
 * ============================================================
 */
function afficherEquipe(equipe, joueurs, logo = null) {
  const joueursEquipe = joueurs.filter(
    joueur => String(joueur.equipeId) === String(equipe.id)
  );

  joueursEquipe.sort((a, b) => (parseInt(a.numero) || 999) - (parseInt(b.numero) || 999));

  const totalButs = joueursEquipe.reduce((total, joueur) => total + (parseInt(joueur.buts) || 0), 0);

  let cartesJoueurs = "";

  for (const joueur of joueursEquipe) {
    cartesJoueurs += `
      <div class="favorite-item">
        <div class="favorite-item-content">
          <div class="favorite-item-icon">${joueur.numero || "-"}</div>
          <div class="favorite-item-name">${joueur.prenom || ""} ${joueur.nom || ""}</div>
        </div>
        <div class="score-container">
          <span class="match-score">${parseInt(joueur.buts) || 0}</span>
        </div>
      </div>
    `;
  }

  if (joueursEquipe.length === 0) {
    cartesJoueurs = `
      <div style="text-align: center; color: var(--text-muted); padding: 12px; font-size: 14px;">
        Aucun joueur répertorié.
      </div>
    `;
  }

  const logoHTML = logo
    ? `<img src="${logo}" alt="Logo" style="width: 40px; height: 40px; object-fit: contain; flex-shrink: 0;">`
    : `<div class="card-icon"><i class="ri-team-line"></i></div>`;

  return `
    <div class="card">
      <div class="card-header">
        ${logoHTML}
        <div class="card-title" style="min-width: 0;">
          <div style="font-size: 15px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${equipe.libelle || "Équipe"}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); font-weight: 500;">
            ${joueursEquipe.length} joueur(s)
          </div>
        </div>
        <div class="card-badge" style="flex-shrink: 0;">
          Total: ${totalButs} but(s)
        </div>
      </div>

      <div class="favorites-list">
        ${cartesJoueurs}
      </div>
    </div>
  `;
}

/*
 * ============================================================
 * RENDU DU MATCH COMPLET
 * ============================================================
 */
function afficherMatch(data) {
  resultats.innerHTML = "";

  if (!data || !data.statsJoueurs || !data.equipe1 || !data.equipe2) {
    throw new Error("Structure de données de match incomplète.");
  }

  const logoEquipe1 = data.score?.home?.flag?.url || null;
  const logoEquipe2 = data.score?.away?.flag?.url || null;

  const scoreEquipe1 = data.score?.home?.score ?? data.statsJoueurs
    .filter(j => String(j.equipeId) === String(data.equipe1.id))
    .reduce((t, j) => t + (parseInt(j.buts) || 0), 0);

  const scoreEquipe2 = data.score?.away?.score ?? data.statsJoueurs
    .filter(j => String(j.equipeId) === String(data.equipe2.id))
    .reduce((t, j) => t + (parseInt(j.buts) || 0), 0);

  let dateFormatted = "";
  let journeeTexte = "";

  const rencontreInfo = data.rematch?.rencontre;
  if (rencontreInfo) {
    if (rencontreInfo.journeeNumero) {
      journeeTexte = `Journée ${rencontreInfo.journeeNumero}`;
    }
    if (rencontreInfo.date) {
      const d = new Date(rencontreInfo.date.replace(" ", "T"));
      if (!isNaN(d.getTime())) {
        dateFormatted = d.toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric"
        }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      }
    }
  }

  const logoHTML1 = logoEquipe1 
    ? `<img src="${logoEquipe1}" alt="Logo" style="width: 44px; height: 44px; object-fit: contain;">`
    : `<div class="card-icon" style="margin: 0;"><i class="ri-team-line"></i></div>`;

  const logoHTML2 = logoEquipe2 
    ? `<img src="${logoEquipe2}" alt="Logo" style="width: 44px; height: 44px; object-fit: contain;">`
    : `<div class="card-icon" style="margin: 0;"><i class="ri-team-line"></i></div>`;

  const matchHeaderHTML = `
    <div class="card" style="margin-bottom: 20px; padding: 14px; text-align: center;">
      ${journeeTexte || dateFormatted ? `
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px;">
          ${journeeTexte} ${journeeTexte && dateFormatted ? "•" : ""} ${dateFormatted}
        </div>
      ` : ""}
      
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;">
          ${logoHTML1}
          <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); line-height: 1.2; text-align: center; width: 100%; word-break: break-word;">
            ${data.equipe1.libelle || "Équipe 1"}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; padding: 0 4px;">
          <div style="font-size: 24px; font-weight: 800; color: var(--primary); letter-spacing: 0.5px; white-space: nowrap;">
            ${scoreEquipe1} : ${scoreEquipe2}
          </div>
          <span style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">
            Score final
          </span>
        </div>

        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;">
          ${logoHTML2}
          <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); line-height: 1.2; text-align: center; width: 100%; word-break: break-word;">
            ${data.equipe2.libelle || "Équipe 2"}
          </div>
        </div>
      </div>
    </div>
  `;

  resultats.innerHTML = `
    ${matchHeaderHTML}
    <div class="section-header">
      <div class="section-title">Détail des joueurs</div>
    </div>
    ${afficherEquipe(data.equipe1, data.statsJoueurs, logoEquipe1)}
    ${afficherEquipe(data.equipe2, data.statsJoueurs, logoEquipe2)}
  `;
}

async function analyserMatch() {
  const matchUrl = input.value.trim();
  resultats.innerHTML = "";
  debug.style.display = "none";
  debug.textContent = "";

  if (!matchUrl || !verifierUrl(matchUrl)) {
    afficherStatus("Collez une URL FFHandball valide.", "error");
    return;
  }

  button.disabled = true;
  afficherStatus("Chargement des statistiques...", "loading");

  try {
    const proxyUrl = WORKER_URL + "?url=" + encodeURIComponent(matchUrl);
    const response = await fetch(proxyUrl);

    if (!response.ok) throw new Error("Erreur HTTP " + response.status);

    const html = await response.text();
    if (!html) throw new Error("La réponse reçue est vide.");

    const data = extraireDonnees(html);
    afficherMatch(data);
    afficherStatus("Statistiques chargées avec succès !", "success");

  } catch (error) {
    console.error(error);
    afficherStatus("Erreur : " + error.message, "error");
    debug.style.display = "block";
    debug.textContent = error.stack || error.message;
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", analyserMatch);
input.addEventListener("keydown", event => {
  if (event.key === "Enter") analyserMatch();
});
