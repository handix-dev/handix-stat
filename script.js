/*
 * ============================================================
 * CONFIGURATION & ELEMENTS
 * ============================================================
 */
const WORKER_URL = "https://silent-salad-f4a2.handix-officiel.workers.dev/";

const input = document.getElementById("matchUrl");
const button = document.getElementById("analyser");
const status = document.getElementById("status");
const resultats = document.getElementById("resultats");
const debug = document.getElementById("debug");

/*
 * ============================================================
 * GESTION DE L'AFFICHAGE D'ÉTAT
 * ============================================================
 */
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

/*
 * ============================================================
 * VALIDEUR D'URL
 * ============================================================
 */
function verifierUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "www.ffhandball.fr" ||
      parsed.hostname === "ffhandball.fr"
    );
  } catch {
    return false;
  }
}

/*
 * ============================================================
 * EXTRACTION DES DONNÉES DU DOM PARSÉ
 * ============================================================
 */
function extraireDonnees(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const component = doc.querySelector(
    'smartfire-component[name="competitions---rencontre-liste-joueurs"]'
  );

  if (!component) {
    throw new Error("Le composant des statistiques joueurs est introuvable sur la page.");
  }

  let attributes = component.getAttribute("attributes");

  if (!attributes) {
    throw new Error("Les données du match sont vides.");
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = attributes;
  attributes = textarea.value;

  try {
    return JSON.parse(attributes);
  } catch (error) {
    console.error("JSON brut :", attributes);
    throw new Error("Impossible d'analyser le format JSON des joueurs.");
  }
}

/*
 * ============================================================
 * RENDU D'UNE ÉQUIPE
 * ============================================================
 */
function afficherEquipe(equipe, joueurs) {
  const joueursEquipe = joueurs.filter(
    joueur => String(joueur.equipeId) === String(equipe.id)
  );

  joueursEquipe.sort((a, b) => {
    const numeroA = parseInt(a.numero) || 999;
    const numeroB = parseInt(b.numero) || 999;
    return numeroA - numeroB;
  });

  const totalButs = joueursEquipe.reduce((total, joueur) => {
    return total + (parseInt(joueur.buts) || 0);
  }, 0);

  let cartesJoueurs = "";

  for (const joueur of joueursEquipe) {
    const numero = joueur.numero || "-";
    const prenom = joueur.prenom || "";
    const nom = joueur.nom || "";
    const buts = parseInt(joueur.buts) || 0;

    cartesJoueurs += `
      <div class="favorite-item">
        <div class="favorite-item-content">
          <div class="favorite-item-icon">
            ${numero}
          </div>
          <div class="favorite-item-name">
            ${prenom} ${nom}
          </div>
        </div>
        <div class="score-container">
          <span class="match-score">${buts}</span>
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

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-icon">
          <i class="ri-team-line"></i>
        </div>
        <div class="card-title">
          <div style="font-size: 16px; font-weight: 800;">${equipe.libelle || "Équipe"}</div>
          <div style="font-size: 12px; color: var(--text-muted); font-weight: 500;">
            ${joueursEquipe.length} joueur(s)
          </div>
        </div>
        <div class="card-badge">
          Total: ${totalButs} goal(s)
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

  resultats.innerHTML = `
    <div class="section-header">
      <div class="section-title">Feuille de match</div>
    </div>
    ${afficherEquipe(data.equipe1, data.statsJoueurs)}
    ${afficherEquipe(data.equipe2, data.statsJoueurs)}
  `;
}

/*
 * ============================================================
 * LOGIQUE PRINCIPALE D'ANALYSE
 * ============================================================
 */
async function analyserMatch() {
  const matchUrl = input.value.trim();

  resultats.innerHTML = "";
  debug.style.display = "none";
  debug.textContent = "";

  if (!matchUrl) {
    afficherStatus("Collez l'URL d'un match FFHandball.", "error");
    return;
  }

  if (!verifierUrl(matchUrl)) {
    afficherStatus("L'URL doit être une URL FFHandball valide.", "error");
    return;
  }

  button.disabled = true;
  afficherStatus("Chargement des statistiques...", "loading");

  try {
    const proxyUrl = WORKER_URL + "?url=" + encodeURIComponent(matchUrl);
    const response = await fetch(proxyUrl);

    if (!response.ok) {
      const erreur = await response.text();
      throw new Error("Erreur Worker HTTP " + response.status + " : " + erreur.substring(0, 200));
    }

    const html = await response.text();

    if (!html) {
      throw new Error("La réponse reçue est vide.");
    }

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

/*
 * ============================================================
 * ÉVÉNEMENTS
 * ============================================================
 */
button.addEventListener("click", analyserMatch);

input.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    analyserMatch();
  }
});
