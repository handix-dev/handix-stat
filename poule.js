/*
 * ============================================================
 * CONFIGURATION & ÉLÉMENTS
 * ============================================================
 */
const WORKER_URL = "https://silent-salad-f4a2.handix-officiel.workers.dev/";

const input = document.getElementById("matchUrl");
const button = document.getElementById("analyser");
const status = document.getElementById("status");
const vueListe = document.getElementById("vueListe");
const vueDetail = document.getElementById("vueDetail");
const detailContenu = document.getElementById("detailContenu");
const debug = document.getElementById("debug");

const pouleActions = document.getElementById("pouleActions");
const btnAjouterFavori = document.getElementById("btnAjouterFavori");
const favorisPouleContainer = document.getElementById("favorisPouleContainer");
const favorisPouleList = document.getElementById("favorisPouleList");

let listeMatchsPoule = [];
let urlPouleCourante = "";

/*
 * ============================================================
 * GESTION DU LOCALSTORAGE (FAVORIS)
 * ============================================================
 */
function getFavoris() {
  try {
    return JSON.parse(localStorage.getItem("handix_favoris_poules")) || [];
  } catch {
    return [];
  }
}

function saveFavoris(favoris) {
  localStorage.setItem("handix_favoris_poules", JSON.stringify(favoris));
  afficherFavorisBarre();
}

function ajouterFavoriPoule() {
  if (!urlPouleCourante) return;

  const nom = prompt("Entrez un nom pour cette poule (ex: Seniors G1, U18 F) :");
  if (!nom || !nom.trim()) return;

  const favoris = getFavoris();
  const existe = favoris.some(f => f.url === urlPouleCourante);

  if (existe) {
    alert("Cette poule est déjà dans vos favoris.");
    return;
  }

  favoris.push({ nom: nom.trim(), url: urlPouleCourante });
  saveFavoris(favoris);
}

function supprimerFavoriPoule(url, event) {
  event.stopPropagation();
  let favoris = getFavoris();
  favoris = favoris.filter(f => f.url !== url);
  saveFavoris(favoris);
}

function chargerPouleFavori(url) {
  input.value = url;
  explorerPoule();
}

function afficherFavorisBarre() {
  const favoris = getFavoris();
  favorisPouleList.innerHTML = "";

  if (favoris.length === 0) {
    favorisPouleContainer.style.display = "none";
    return;
  }

  favorisPouleContainer.style.display = "block";

  favoris.forEach(fav => {
    const chip = document.createElement("div");
    chip.className = "poule-chip";
    chip.innerHTML = `
      <i class="ri-layout-grid-fill" style="color: var(--primary); font-size: 14px;"></i>
      <span>${fav.nom}</span>
      <span class="poule-chip-delete" title="Supprimer"><i class="ri-close-line"></i></span>
    `;

    chip.addEventListener("click", () => chargerPouleFavori(fav.url));
    chip.querySelector(".poule-chip-delete").addEventListener("click", (e) => supprimerFavoriPoule(fav.url, e));

    favorisPouleList.appendChild(chip);
  });
}

/*
 * ============================================================
 * UTILITIES ET EXTRACTION
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

function extraireDonnees(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

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
  
  let joueursData;
  try {
    joueursData = JSON.parse(textareaJoueurs.value);
  } catch {
    return null;
  }

  const scoreComponent = doc.querySelector('smartfire-component[name="competitions---competition-score"]');
  let scoreData = null;
  if (scoreComponent) {
    let attr = scoreComponent.getAttribute("attributes");
    if (attr) {
      const ta = document.createElement("textarea");
      ta.innerHTML = attr;
      try { scoreData = JSON.parse(ta.value); } catch (e) {}
    }
  }

  const rematchComponent = doc.querySelector('smartfire-component[name="competitions---rematch"]');
  let rematchData = null;
  if (rematchComponent) {
    let attr = rematchComponent.getAttribute("attributes");
    if (attr) {
      const ta = document.createElement("textarea");
      ta.innerHTML = attr;
      try { rematchData = JSON.parse(ta.value); } catch (e) {}
    }
  }

  return {
    ...joueursData,
    score: scoreData,
    rematch: rematchData
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

async function explorerPoule() {
  const targetUrl = input.value.trim();
  vueListe.innerHTML = "";
  vueDetail.style.display = "none";
  vueListe.style.display = "block";
  pouleActions.style.display = "none";
  listeMatchsPoule = [];

  if (!verifierUrl(targetUrl)) {
    afficherStatus("Veuillez saisir une URL de rencontre FFHandball valide.", "error");
    return;
  }

  urlPouleCourante = targetUrl;
  button.disabled = true;
  afficherStatus("Analyse du match de départ...", "loading");

  const matchInitial = await chargerMatch(targetUrl);

  if (!matchInitial) {
    afficherStatus("Impossible d'extraire les données du match.", "error");
    button.disabled = false;
    return;
  }

  listeMatchsPoule.push(matchInitial);

  const urlParts = targetUrl.match(/(.*\/rencontre-)(\d+)(\/?.*)/);
  if (!urlParts) {
    afficherStatus("Format d'URL non reconnu.", "error");
    button.disabled = false;
    return;
  }

  const baseUrl = urlParts[1];
  const baseId = parseInt(urlParts[2], 10);
  const endUrl = urlParts[3] || "";

  // Scan avant
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

  // Scan arrière
  erreursConsecutives = 0;
  currentId = baseId - 1;

  while (erreursConsecutives < 2 && currentId > 0) {
    afficherStatus(`Recherche des matchs précédents (ID: ${currentId})...`, "loading");
    const testUrl = `${baseUrl}${currentId}${endUrl}`;
    const data = await chargerMatch(testUrl);

    if (data) {
      listeMatchsPoule.unshift(data);
      erreursConsecutives = 0;
    } else {
      erreursConsecutives++;
    }
    currentId--;
  }

  button.disabled = false;
  afficherStatus(`${listeMatchsPoule.length} match(s) trouvé(s) !`, "success");
  pouleActions.style.display = "flex";

  afficherListeParJournee();
}

/*
 * ============================================================
 * AFFICHAGE DES MATCHS
 * ============================================================
 */
function afficherListeParJournee() {
  vueListe.innerHTML = "";

  const journeesMap = new Map();

  listeMatchsPoule.forEach(match => {
    const numJournee = match.rematch?.rencontre?.journeeNumero || "Non classés";
    if (!journeesMap.has(numJournee)) {
      journeesMap.set(numJournee, []);
    }
    journeesMap.get(numJournee).push(match);
  });

  const clesTriees = Array.from(journeesMap.keys()).sort((a, b) => {
    if (a === "Non classés") return 1;
    if (b === "Non classés") return -1;
    return parseInt(a) - parseInt(b);
  });

  clesTriees.forEach(numJournee => {
    const titreHeader = document.createElement("div");
    titreHeader.className = "section-header";
    titreHeader.style.marginTop = "16px";
    titreHeader.innerHTML = `
      <div class="section-title">
        ${numJournee !== "Non classés" ? `Journée ${numJournee}` : "Matchs"}
      </div>
    `;
    vueListe.appendChild(titreHeader);

    const matchsJournee = journeesMap.get(numJournee);

    matchsJournee.forEach(match => {
      const matchIndex = listeMatchsPoule.indexOf(match);
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

      const img1 = logo1 ? `<img src="${logo1}" style="width: 24px; height: 24px; object-fit: contain; flex-shrink: 0;">` : `<i class="ri-team-line" style="font-size: 20px;"></i>`;
      const img2 = logo2 ? `<img src="${logo2}" style="width: 24px; height: 24px; object-fit: contain; flex-shrink: 0;">` : `<i class="ri-team-line" style="font-size: 20px;"></i>`;

      let dateString = "";
      if (match.rematch?.rencontre?.date) {
        const d = new Date(match.rematch.rencontre.date.replace(" ", "T"));
        if (!isNaN(d.getTime())) {
          dateString = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + " - " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        }
      }

      const card = document.createElement("div");
      card.className = "card";
      card.style.cursor = "pointer";
      card.style.marginBottom = "10px";
      card.style.padding = "10px 12px";

      card.innerHTML = `
        ${dateString ? `<div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; text-align: center;">${dateString}</div>` : ""}
        
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          
          <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px;">
            ${img1}
            <span style="font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${eq1}">${eq1}</span>
          </div>

          <div style="font-size: 16px; font-weight: 800; color: var(--primary); padding: 2px 8px; flex-shrink: 0; background: rgba(0,0,0,0.03); border-radius: 6px; white-space: nowrap;">
            ${score1} : ${score2}
          </div>

          <div style="flex: 1; min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: 6px; text-align: right;">
            <span style="font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${eq2}">${eq2}</span>
            ${img2}
          </div>

        </div>
      `;

      card.addEventListener("click", () => afficherDetailMatch(matchIndex));
      vueListe.appendChild(card);
    });
  });
}

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
    ? `<img src="${logo}" style="width: 40px; height: 40px; object-fit: contain; flex-shrink: 0;">`
    : `<div class="card-icon"><i class="ri-team-line"></i></div>`;

  return `
    <div class="card">
      <div class="card-header">
        ${logoHTML}
        <div class="card-title" style="min-width: 0;">
          <div style="font-size: 15px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${equipe.libelle || "Équipe"}</div>
          <div style="font-size: 12px; color: var(--text-muted); font-weight: 500;">${joueursEquipe.length} joueur(s)</div>
        </div>
        <div class="card-badge" style="flex-shrink: 0;">Total: ${totalButs} but(s)</div>
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

  let dateFormatted = "";
  let journeeTexte = "";

  const rencontreInfo = data.rematch?.rencontre;
  if (rencontreInfo) {
    if (rencontreInfo.journeeNumero) journeeTexte = `Journée ${rencontreInfo.journeeNumero}`;
    if (rencontreInfo.date) {
      const d = new Date(rencontreInfo.date.replace(" ", "T"));
      if (!isNaN(d.getTime())) {
        dateFormatted = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      }
    }
  }

  const logoHTML1 = logoEquipe1 
    ? `<img src="${logoEquipe1}" style="width: 44px; height: 44px; object-fit: contain;">`
    : `<div class="card-icon" style="margin: 0;"><i class="ri-team-line"></i></div>`;

  const logoHTML2 = logoEquipe2 
    ? `<img src="${logoEquipe2}" style="width: 44px; height: 44px; object-fit: contain;">`
    : `<div class="card-icon" style="margin: 0;"><i class="ri-team-line"></i></div>`;

  detailContenu.innerHTML = `
    <div class="card" style="margin-bottom: 20px; padding: 16px; text-align: center;">
      
      <div style="display: flex; justify-content: center; margin-bottom: 12px;">
        <button id="btnRetourInCard" class="search-button" style="width: auto; padding: 6px 14px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;" type="button">
          <i class="ri-arrow-left-line"></i> Retour aux matchs
        </button>
      </div>

      ${journeeTexte || dateFormatted ? `
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
          ${journeeTexte} ${journeeTexte && dateFormatted ? "•" : ""} ${dateFormatted}
        </div>
      ` : ""}

      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;">
          ${logoHTML1}
          <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); line-height: 1.2; text-align: center; width: 100%; word-break: break-word;">
            ${data.equipe1.libelle}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; padding: 0 4px;">
          <div style="font-size: 24px; font-weight: 800; color: var(--primary); letter-spacing: 0.5px; white-space: nowrap;">
            ${scoreEquipe1} : ${scoreEquipe2}
          </div>
          <span style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">Score final</span>
        </div>

        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;">
          ${logoHTML2}
          <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); line-height: 1.2; text-align: center; width: 100%; word-break: break-word;">
            ${data.equipe2.libelle}
          </div>
        </div>
      </div>
    </div>

    <div class="section-header">
      <div class="section-title">Détail des joueurs</div>
    </div>

    ${afficherEquipe(data.equipe1, data.statsJoueurs, logoEquipe1)}
    ${afficherEquipe(data.equipe2, data.statsJoueurs, logoEquipe2)}
  `;

  document.getElementById("btnRetourInCard").addEventListener("click", () => {
    vueDetail.style.display = "none";
    vueListe.style.display = "block";
  });

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
btnAjouterFavori.addEventListener("click", ajouterFavoriPoule);

// Initialisation des favoris au chargement de la page
afficherFavorisBarre();
