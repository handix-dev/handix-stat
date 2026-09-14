/*
 * ============================================================
 * CONFIGURATION & ELEMENTS
 * ============================================================
 */
const WORKER_URL = "https://silent-salad-f4a2.handix-officiel.workers.dev/";

const input = document.getElementById("matchUrl");
const button = document.getElementById("analyser");
const status = document.getElementById("status");
const vueListe = document.getElementById("vueListe");
const vueDetail = document.getElementById("vueDetail");
const detailContenu = document.getElementById("detailContenu");
const btnRetour = document.getElementById("btnRetour");
const debug = document.getElementById("debug");

let listeMatchsPoule = [];

/*
 * ============================================================
 * AFFICHAGE D'ÉTAT
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

function verifierUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === "www.ffhandball.fr" || parsed.hostname === "ffhandball.fr") &&
      parsed.pathname.includes("/rencontre-")
    );
  } catch {
    return false;
  }
}

/*
 * ============================================================
 * PARSER UN MATCH
 * ============================================================
 */
function extraireDonnees(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  /* Verification de présence de la page 404 FFHandball */
  if (doc.querySelector('smartfire-component[name="page-404"]')) {
    return null;
  }

  const joueursComponent = doc.querySelector(
    'smartfire-component[name="competitions---rencontre-liste-joueurs"]'
  );

  if (!joueursComponent) return null;

  let attributesJoueurs = joueursComponent.getAttribute("attributes");
  if (!attributesJoueurs) return null;

  const textareaJoueurs = document.createElement("textarea");
  textareaJoueurs.innerHTML = attributesJoueurs;
  attributesJoueurs = textareaJoueurs.value;

  let joueursData;
  try {
    joueursData = JSON.parse(attributesJoueurs);
  } catch {
    return null;
  }

  /* Score & Infos */
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
      } catch (e) {
        console.warn("Erreur parsing score:", e);
      }
    }
  }

  return {
    ...joueursData,
    score: scoreData
  };
}

async function chargerMatch(url) {
  try {
    const proxyUrl = WORKER_URL + "?url=" + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;

    const html = await response.text();
    if (!html) return null;

    return extraireDonnees(html);
  } catch {
    return null;
  }
}

/*
 * ============================================================
 * EXPLORATION DE LA POULE
 * ============================================================
 */
async function explorerPoule() {
  const targetUrl = input.value.trim();
  vueListe.innerHTML = "";
  vueDetail.style.display = "none";
  vueListe.style.display = "block";
  listeMatchsPoule = [];

  if (!verifierUrl(targetUrl)) {
    afficherStatus("Veuillez saisir une URL de rencontre FFHandball valide.", "error");
    return;
  }

  button.disabled = true;
  afficherStatus("Analyse du match de départ...", "loading");

  const matchInitial = await chargerMatch(targetUrl);

  if (!matchInitial) {
    afficherStatus("Impossible d'extraire les données du match saisi.", "error");
    button.disabled = false;
    return;
  }

  listeMatchsPoule.push(matchInitial);

  /* Extraction de l'ID et de la structure de l'URL */
  const urlParts = targetUrl.match(/(.*\/rencontre-)(\d+)(\/?.*)/);
  if (!urlParts) {
    afficherStatus("Format d'URL non reconnu pour le balayage automatique.", "error");
    button.disabled = false;
    return;
  }

  const baseUrl = urlParts[1];
  const baseId = parseInt(urlParts[2], 10);
  const endUrl = urlParts[3] || "";

  /* Recherche vers l'AVANT (IDs croissants) */
  let erreursConsecutives = 0;
  let currentId = baseId + 1;

  while (erreursConsecutives < 2) {
    afficherStatus(`Recherche des matchs suivants (ID: ${currentId})...`, "loading");
    const testUrl = `${baseUrl}${currentId}${endUrl}`;
    const data = await chargerMatch(testUrl);

    if (data) {
      listeMatchsPoule.push(data);
      erreursConsecutives = 0;
    } else {
      erreursConsecutives++;
    }
    currentId++;
  }

  /* Recherche vers l'ARRIÈRE (IDs décroissants) */
  erreursConsecutives = 0;
  currentId = baseId - 1;

  while (erreursConsecutives < 2 && currentId > 0) {
    afficherStatus(`Recherche des matchs précédents (ID: ${currentId})...`, "loading");
    const testUrl = `${baseUrl}${currentId}${endUrl}`;
    const data = await chargerMatch(testUrl);

    if (data) {
      listeMatchsPoule.unshift(data); // Ajoute au début
      erreursConsecutives = 0;
    } else {
      erreursConsecutives++;
    }
    currentId--;
  }

  button.disabled = false;
  afficherStatus(`${listeMatchsPoule.length} match(s) trouvé(s) dans cette poule !`, "success");

  afficherListeMatchs();
}

/*
 * ============================================================
 * AFFICHAGE LISTE
 * ============================================================
 */
function afficherListeMatchs() {
  vueListe.innerHTML = `
    <div class="section-header">
      <div class="section-title">Matchs de la poule</div>
    </div>
  `;

  listeMatchsPoule.forEach((match, index) => {
    const eq1 = match.equipe1?.libelle || "Équipe 1";
    const eq2 = match.equipe2?.libelle || "Équipe 2";

    const score1 = match.score?.home?.score ?? match.statsJoueurs
      .filter(j => String(j.equipeId) === String(match.equipe1.id))
      .reduce((t, j) => t + (parseInt(j.buts) || 0), 0);

    const score2 = match.score?.away?.score ?? match.statsJoueurs
      .filter(j => String(j.equipeId) === String(match.equipe2.id))
      .reduce((t, j) => t + (parseInt(j.buts) || 0), 0);

    const logo1 = match.score?.home?.flag?.url;
    const logo2 = match.score?.away?.flag?.url;

    const img1 = logo1 ? `<img src="${logo1}" style="width: 28px; height: 28px; object-fit: contain;">` : `<i class="ri-team-line"></i>`;
    const img2 = logo2 ? `<img src="${logo2}" style="width: 28px; height: 28px; object-fit: contain;">` : `<i class="ri-team-line"></i>`;

    const card = document.createElement("div");
    card.className = "card";
    card.style.cursor = "pointer";
    card.style.marginBottom = "12px";

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px;">
        <div style="flex: 1; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px;">
          ${img1}
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${eq1}</span>
        </div>

        <div style="font-size: 18px; font-weight: 800; color: var(--primary); padding: 0 8px;">
          ${score1} : ${score2}
        </div>

        <div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 8px; font-weight: 700; font-size: 13px; text-align: right;">
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${eq2}</span>
          ${img2}
        </div>
      </div>
    `;

    card.addEventListener("click", () => afficherDetailMatch(index));
    vueListe.appendChild(card);
  });
}

/*
 * ============================================================
 * AFFICHAGE DÉTAIL MATCH (IDENTIQUE À INDEX)
 * ============================================================
 */
function afficherEquipe(equipe, joueurs, logo = null) {
  const joueursEquipe = joueurs.filter(j => String(j.equipeId) === String(equipe.id));
  joueursEquipe.sort((a, b) => (parseInt(a.numero) || 999) - (parseInt(b.numero) || 999));

  const totalButs = joueursEquipe.reduce((t, j) => t + (parseInt(j.buts) || 0), 0);
  let cartesJoueurs = "";

  joueursEquipe.forEach(joueur => {
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
  });

  const logoHTML = logo
    ? `<img src="${logo}" style="width: 48px; height: 48px; object-fit: contain;">`
    : `<div class="card-icon"><i class="ri-team-line"></i></div>`;

  return `
    <div class="card">
      <div class="card-header">
        ${logoHTML}
        <div class="card-title">
          <div style="font-size: 16px; font-weight: 800;">${equipe.libelle || "Équipe"}</div>
          <div style="font-size: 12px; color: var(--text-muted); font-weight: 500;">${joueursEquipe.length} joueur(s)</div>
        </div>
        <div class="card-badge">Total: ${totalButs} but(s)</div>
      </div>
      <div class="favorites-list">${cartesJoueurs}</div>
    </div>
  `;
}

function afficherDetailMatch(index) {
  const data = listeMatchsPoule[index];
  if (!data) return;

  const logoEquipe1 = data.score?.home?.flag?.url || null;
  const logoEquipe2 = data.score?.away?.flag?.url || null;

  const scoreEquipe1 = data.score?.home?.score ?? data.statsJoueurs
    .filter(j => String(j.equipeId) === String(data.equipe1.id))
    .reduce((t, j) => t + (parseInt(j.buts) || 0), 0);

  const scoreEquipe2 = data.score?.away?.score ?? data.statsJoueurs
    .filter(j => String(j.equipeId) === String(data.equipe2.id))
    .reduce((t, j) => t + (parseInt(j.buts) || 0), 0);

  const logoHTML1 = logoEquipe1 
    ? `<img src="${logoEquipe1}" style="width: 52px; height: 52px; object-fit: contain;">`
    : `<div class="card-icon" style="margin: 0;"><i class="ri-team-line"></i></div>`;

  const logoHTML2 = logoEquipe2 
    ? `<img src="${logoEquipe2}" style="width: 52px; height: 52px; object-fit: contain;">`
    : `<div class="card-icon" style="margin: 0;"><i class="ri-team-line"></i></div>`;

  detailContenu.innerHTML = `
    <div class="card" style="margin-bottom: 20px; text-align: center;">
      <div style="display: flex; align-items: center; justify-content: space-around; gap: 12px;">
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
          ${logoHTML1}
          <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary); line-height: 1.2;">${data.equipe1.libelle}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 90px;">
          <div style="font-size: 26px; font-weight: 800; color: var(--primary); letter-spacing: 1px;">${scoreEquipe1} : ${scoreEquipe2}</div>
          <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">Score final</span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
          ${logoHTML2}
          <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary); line-height: 1.2;">${data.equipe2.libelle}</div>
        </div>
      </div>
    </div>

    <div class="section-header">
      <div class="section-title">Détail des joueurs</div>
    </div>

    ${afficherEquipe(data.equipe1, data.statsJoueurs, logoEquipe1)}
    ${afficherEquipe(data.equipe2, data.statsJoueurs, logoEquipe2)}
  `;

  vueListe.style.display = "none";
  vueDetail.style.display = "block";
}

/*
 * ============================================================
 * ÉVÉNEMENTS
 * ============================================================
 */
button.addEventListener("click", explorerPoule);
input.addEventListener("keydown", event => {
  if (event.key === "Enter") explorerPoule();
});

btnRetour.addEventListener("click", () => {
  vueDetail.style.display = "none";
  vueListe.style.display = "block";
});
