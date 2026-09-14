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

// CORRECTION: Assure que les scores sont manipulés comme des nombres (Number / parseInt)
function ObtenirScoresMatch(m) {
  if (!m) return { s1: 0, s2: 0 };

  const id1 = m.equipe1?.id;
  const id2 = m.equipe2?.id;

  let s1 = m.score?.home?.score;
  let s2 = m.score?.away?.score;

  if (s1 === undefined || s1 === null) {
    s1 = id1 ? m.statsJoueurs?.filter(j => String(j.equipeId) === String(id1))
      .reduce((t, j) => t + Number(j.buts || 0), 0) : 0;
  }

  if (s2 === undefined || s2 === null) {
    s2 = id2 ? m.statsJoueurs?.filter(j => String(j.equipeId) === String(id2))
      .reduce((t, j) => t + Number(j.buts || 0), 0) : 0;
  }

  return { 
    s1: Math.max(0, parseInt(s1, 10) || 0), 
    s2: Math.max(0, parseInt(s2, 10) || 0) 
  };
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
  let zeroZeroConsecutifs = 0;
  let currentId = baseId + 1;

  while (erreursConsecutives < 2 && zeroZeroConsecutifs < 5) {
    afficherStatus(`Recherche des matchs suivants (ID: ${currentId})...`, "loading");
    const testUrl = `${baseUrl}${currentId}${endUrl}`;
    const data = await chargerMatch(testUrl);

    if (data) {
      listeMatchsPoule.push(data);
      erreursConsecutives = 0;

      const { s1, s2 } = ObtenirScoresMatch(data);
      if (s1 === 0 && s2 === 0) {
        zeroZeroConsecutifs++;
      } else {
        zeroZeroConsecutifs = 0;
      }
    } else {
      erreursConsecutives++;
    }
    currentId++;
  }

  // Scan arrière
  erreursConsecutives = 0;
  zeroZeroConsecutifs = 0;
  currentId = baseId - 1;

  while (erreursConsecutives < 2 && zeroZeroConsecutifs < 5 && currentId > 0) {
    afficherStatus(`Recherche des matchs précédents (ID: ${currentId})...`, "loading");
    const testUrl = `${baseUrl}${currentId}${endUrl}`;
    const data = await chargerMatch(testUrl);

    if (data) {
      listeMatchsPoule.unshift(data);
      erreursConsecutives = 0;

      const { s1, s2 } = ObtenirScoresMatch(data);
      if (s1 === 0 && s2 === 0) {
        zeroZeroConsecutifs++;
      } else {
        zeroZeroConsecutifs = 0;
      }
    } else {
      erreursConsecutives++;
    }
    currentId--;
  }

  button.disabled = false;
  afficherStatus(`${listeMatchsPoule.length} match(s) trouvé(s) !`, "success");
  pouleActions.style.display = "flex";

  // On affiche le classement en premier, puis la liste des matchs
  afficherClassement();
  afficherListeParJournee();
}

/*
 * ============================================================
 * CALCUL ET AFFICHAGE DU CLASSEMENT
 * ============================================================
 */
function genererClassement() {
  const classement = {};

  listeMatchsPoule.forEach(match => {
    const id1 = match.equipe1?.id;
    const id2 = match.equipe2?.id;
    if (!id1 || !id2) return;

    if (!classement[id1]) classement[id1] = { nom: match.equipe1.libelle, pts: 0, joue: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0, diff: 0 };
    if (!classement[id2]) classement[id2] = { nom: match.equipe2.libelle, pts: 0, joue: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0, diff: 0 };

    const { s1, s2 } = ObtenirScoresMatch(match);

    // Ignorer les matchs non joués (souvent à 0-0 sans stats)
    if (s1 === 0 && s2 === 0 && (!match.statsJoueurs || match.statsJoueurs.length === 0)) return;

    classement[id1].joue++;
    classement[id2].joue++;
    
    classement[id1].bp += s1;
    classement[id1].bc += s2;
    classement[id2].bp += s2;
    classement[id2].bc += s1;

    // Barème standard Handball : Victoire = 3pts, Nul = 2pts, Défaite = 1pt
    if (s1 > s2) {
      classement[id1].v++; classement[id1].pts += 3;
      classement[id2].d++; classement[id2].pts += 1;
    } else if (s1 < s2) {
      classement[id2].v++; classement[id2].pts += 3;
      classement[id1].d++; classement[id1].pts += 1;
    } else {
      classement[id1].n++; classement[id1].pts += 2;
      classement[id2].n++; classement[id2].pts += 2;
    }
  });

  // Calcul propre de la différence de buts
  Object.values(classement).forEach(eq => {
    eq.diff = eq.bp - eq.bc;
  });

  // Tri : Points (desc), Différence de buts (desc), Buts marqués (desc)
  return Object.values(classement).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.bp - a.bp;
  });
}

function afficherClassement() {
  const donneesClassement = genererClassement();
  
  if (donneesClassement.length === 0) return;

  const tableHTML = donneesClassement.map((eq, index) => `
    <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
      <td style="padding: 8px 4px; text-align: center; font-weight: 700; color: var(--text-muted);">${index + 1}</td>
      <td style="padding: 8px 4px; font-weight: 600; font-size: 13px; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${eq.nom}</td>
      <td style="padding: 8px 4px; text-align: center; font-weight: 800; color: var(--primary);">${eq.pts}</td>
      <td style="padding: 8px 4px; text-align: center;">${eq.joue}</td>
      <td style="padding: 8px 4px; text-align: center; color: #10b981;">${eq.v}</td>
      <td style="padding: 8px 4px; text-align: center; color: #f59e0b;">${eq.n}</td>
      <td style="padding: 8px 4px; text-align: center; color: #ef4444;">${eq.d}</td>
      <td style="padding: 8px 4px; text-align: center; font-weight: 700;">${eq.diff > 0 ? '+' + eq.diff : eq.diff}</td>
    </tr>
  `).join("");

  const classementDiv = document.createElement("div");
  classementDiv.className = "card";
  classementDiv.style.marginBottom = "20px";
  classementDiv.innerHTML = `
    <div class="section-header" style="padding: 12px 16px 0;">
      <div class="section-title">Classement de la poule</div>
    </div>
    <div style="overflow-x: auto; padding: 0 16px 16px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="border-bottom: 2px solid rgba(0,0,0,0.1); color: var(--text-muted); text-transform: uppercase; font-size: 10px;">
            <th style="padding: 8px 4px; text-align: center;">#</th>
            <th style="padding: 8px 4px; text-align: left;">Équipe</th>
            <th style="padding: 8px 4px; text-align: center;">Pts</th>
            <th style="padding: 8px 4px; text-align: center;">J</th>
            <th style="padding: 8px 4px; text-align: center;">V</th>
            <th style="padding: 8px 4px; text-align: center;">N</th>
            <th style="padding: 8px 4px; text-align: center;">D</th>
            <th style="padding: 8px 4px; text-align: center;">Diff</th>
          </tr>
        </thead>
        <tbody>
          ${tableHTML}
        </tbody>
      </table>
    </div>
  `;

  vueListe.appendChild(classementDiv);
}

/*
 * ============================================================
 * AFFICHAGE DES MATCHS
 * ============================================================
 */
function afficherListeParJournee() {
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

      const { s1: score1, s2: score2 } = ObtenirScoresMatch(match);

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

  const { s1: scoreEquipe1, s2: scoreEquipe2 } = ObtenirScoresMatch(data);

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
