/*
 * ============================================================
 * CONFIGURATION & ÉLÉMENTS
 * ============================================================
 */
const WORKER_URL = "https://silent-salad-f4a2.handix-officiel.workers.dev/";

const input = document.getElementById("matchUrl");
const button = document.getElementById("analyser");
const status = document.getElementById("status");

const favorisPouleContainer = document.getElementById("favorisPouleContainer");
const favorisPouleList = document.getElementById("favorisPouleList");

const classementToggles = document.getElementById("classementToggles");
const btnTabEquipes = document.getElementById("btnTabEquipes");
const btnTabButeurs = document.getElementById("btnTabButeurs");

const subToggleButeurs = document.getElementById("subToggleButeurs");
const btnSortButs = document.getElementById("btnSortButs");
const btnSortRatio = document.getElementById("btnSortRatio");

const vueEquipes = document.getElementById("vueEquipes");
const vueButeurs = document.getElementById("vueButeurs");

let listeMatchsPoule = [];
let modeButeurs = "buts"; // "buts" ou "ratio"

/*
 * ============================================================
 * FAVORIS POULE
 * ============================================================
 */
function getFavoris() {
  try {
    return JSON.parse(localStorage.getItem("handix_favoris_poules")) || [];
  } catch {
    return [];
  }
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
      <i class="ri-trophy-line" style="color: var(--primary); font-size: 14px;"></i>
      <span>${fav.nom}</span>
    `;
    chip.addEventListener("click", () => {
      input.value = fav.url;
      explorerPoule();
    });
    favorisPouleList.appendChild(chip);
  });
}

/*
 * ============================================================
 * UTILITAIRES & RÉCUPÉRATION DES MATCHS
 * ============================================================
 */
function afficherStatus(message, type = "") {
  status.className = "";
  status.innerHTML = "";

  if (!type) return;

  if (type === "loading") {
    status.innerHTML = `<div class="loading"><div class="spinner"></div><div>${message}</div></div>`;
  } else if (type === "error") {
    status.innerHTML = `<div class="error-message"><i class="ri-error-warning-line"></i> <div>${message}</div></div>`;
  } else if (type === "success") {
    status.innerHTML = `<div class="success-message"><i class="ri-checkbox-circle-line"></i> ${message}</div>`;
  }
}

function verifierUrl(url) {
  try {
    const parsed = new URL(url);
    return (parsed.hostname === "www.ffhandball.fr" || parsed.hostname === "ffhandball.fr") && parsed.pathname.includes("/rencontre-");
  } catch {
    return false;
  }
}

function extraireDonnees(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  if (doc.querySelector('smartfire-component[name="page-404"]')) return null;

  const joueursComponent = doc.querySelector('smartfire-component[name="competitions---rencontre-liste-joueurs"]');
  if (!joueursComponent) return null;

  let attrJ = joueursComponent.getAttribute("attributes");
  if (!attrJ) return null;

  const ta = document.createElement("textarea");
  ta.innerHTML = attrJ;
  let joueursData;
  try { joueursData = JSON.parse(ta.value); } catch { return null; }

  const scoreComponent = doc.querySelector('smartfire-component[name="competitions---competition-score"]');
  let scoreData = null;
  if (scoreComponent) {
    let attrS = scoreComponent.getAttribute("attributes");
    if (attrS) {
      const taS = document.createElement("textarea");
      taS.innerHTML = attrS;
      try { scoreData = JSON.parse(taS.value); } catch {}
    }
  }

  const rematchComponent = doc.querySelector('smartfire-component[name="competitions---rematch"]');
  let rematchData = null;
  if (rematchComponent) {
    let attrR = rematchComponent.getAttribute("attributes");
    if (attrR) {
      const taR = document.createElement("textarea");
      taR.innerHTML = attrR;
      try { rematchData = JSON.parse(taR.value); } catch {}
    }
  }

  return { ...joueursData, score: scoreData, rematch: rematchData };
}

async function chargerMatch(url) {
  try {
    const proxyUrl = WORKER_URL + "?url=" + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;
    const html = await response.text();
    return html ? extraireDonnees(html) : null;
  } catch {
    return null;
  }
}

async function explorerPoule() {
  const targetUrl = input.value.trim();
  vueEquipes.style.display = "none";
  vueButeurs.style.display = "none";
  classementToggles.style.display = "none";
  listeMatchsPoule = [];

  if (!verifierUrl(targetUrl)) {
    afficherStatus("URL de rencontre FFHandball invalide.", "error");
    return;
  }

  button.disabled = true;
  afficherStatus("Récupération des matchs...", "loading");

  const matchInitial = await chargerMatch(targetUrl);
  if (!matchInitial) {
    afficherStatus("Impossible d'extraire le match.", "error");
    button.disabled = false;
    return;
  }

  listeMatchsPoule.push(matchInitial);

  const urlParts = targetUrl.match(/(.*\/rencontre-)(\d+)(\/?.*)/);
  if (!urlParts) return;

  const baseUrl = urlParts[1];
  const baseId = parseInt(urlParts[2], 10);
  const endUrl = urlParts[3] || "";

  // Scan vers l'avant
  let err = 0, currentId = baseId + 1;
  while (err < 2) {
    const data = await chargerMatch(`${baseUrl}${currentId}${endUrl}`);
    if (data) { listeMatchsPoule.push(data); err = 0; } else { err++; }
    currentId++;
  }

  // Scan vers l'arrière
  err = 0; currentId = baseId - 1;
  while (err < 2 && currentId > 0) {
    const data = await chargerMatch(`${baseUrl}${currentId}${endUrl}`);
    if (data) { listeMatchsPoule.unshift(data); err = 0; } else { err++; }
    currentId--;
  }

  button.disabled = false;
  afficherStatus(`${listeMatchsPoule.length} match(s) analysés.`, "success");
  
  classementToggles.style.display = "block";
  calculerEtAfficherTout();
}

/*
 * ============================================================
 * CALCULS DES CLASSEMENTS
 * ============================================================
 */
function calculerEtAfficherTout() {
  genererClassementEquipes();
  genererClassementButeurs();
  afficherOnglet("equipes");
}

function genererClassementEquipes() {
  const equipes = {};

  // Trier les matchs chronologiquement si date disponible
  const matchsTries = [...listeMatchsPoule].sort((a, b) => {
    const dA = a.rematch?.rencontre?.date ? new Date(a.rematch.rencontre.date.replace(" ", "T")) : 0;
    const dB = b.rematch?.rencontre?.date ? new Date(b.rematch.rencontre.date.replace(" ", "T")) : 0;
    return dA - dB;
  });

  matchsTries.forEach(m => {
    if (!m.equipe1 || !m.equipe2) return;

    const id1 = m.equipe1.id, name1 = m.equipe1.libelle;
    const id2 = m.equipe2.id, name2 = m.equipe2.libelle;

    if (!equipes[id1]) equipes[id1] = { name: name1, pts: 0, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, forme: [] };
    if (!equipes[id2]) equipes[id2] = { name: name2, pts: 0, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, forme: [] };

    const s1 = m.score?.home?.score ?? m.statsJoueurs.filter(j => String(j.equipeId) === String(id1)).reduce((t, j) => t + (parseInt(j.buts) || 0), 0);
    const s2 = m.score?.away?.score ?? m.statsJoueurs.filter(j => String(j.equipeId) === String(id2)).reduce((t, j) => t + (parseInt(j.buts) || 0), 0);

    // Ne prendre en compte que si le match a été joué (au moins un but marqué)
    if (s1 > 0 || s2 > 0) {
      equipes[id1].j++; equipes[id2].j++;
      equipes[id1].bp += s1; equipes[id1].bc += s2;
      equipes[id2].bp += s2; equipes[id2].bc += s1;

      if (s1 > s2) {
        equipes[id1].pts += 3; equipes[id1].g++; equipes[id1].forme.push("V");
        equipes[id2].pts += 1; equipes[id2].p++; equipes[id2].forme.push("D");
      } else if (s1 < s2) {
        equipes[id2].pts += 3; equipes[id2].g++; equipes[id2].forme.push("V");
        equipes[id1].pts += 1; equipes[id1].p++; equipes[id1].forme.push("D");
      } else {
        equipes[id1].pts += 2; equipes[id1].n++; equipes[id1].forme.push("N");
        equipes[id2].pts += 2; equipes[id2].n++; equipes[id2].forme.push("N");
      }
    }
  });

  const classement = Object.values(equipes).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const diffA = a.bp - a.bc, diffB = b.bp - b.bc;
    if (diffB !== diffA) return diffB - diffA;
    return b.bp - a.bp;
  });

  let html = `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <thead>
        <tr style="background: var(--primary); color: #fff; height: 36px; font-size: 11px;">
          <th style="padding: 4px;">#</th>
          <th style="text-align: left; padding: 4px 8px;">Équipe</th>
          <th style="padding: 4px;">Pts</th>
          <th style="padding: 4px;">J</th>
          <th style="padding: 4px;">G</th>
          <th style="padding: 4px;">N</th>
          <th style="padding: 4px;">P</th>
          <th style="padding: 4px;">+</th>
          <th style="padding: 4px;">-</th>
          <th style="padding: 4px;">Diff</th>
          <th style="padding: 4px 8px;">Forme</th>
        </tr>
      </thead>
      <tbody>
  `;

  classement.forEach((eq, index) => {
    const diff = eq.bp - eq.bc;
    const formeHTML = eq.forme.slice(-5).map(f => {
      let bg = "#e63946"; // Rouge (Défaite)
      if (f === "V") bg = "#2a9d8f"; // Vert (Victoire)
      if (f === "N") bg = "#f4a261"; // Orange (Nul)
      return `<span style="display: inline-block; width: 14px; height: 14px; line-height: 14px; color: #fff; font-size: 9px; font-weight: 800; border-radius: 3px; background: ${bg}; margin: 0 1px;">${f}</span>`;
    }).join("");

    html += `
      <tr style="border-bottom: 1px solid rgba(0,0,0,0.05); height: 40px; font-weight: 500;">
        <td style="font-weight: 800; padding: 4px;">${index + 1}</td>
        <td style="text-align: left; font-weight: 700; padding: 4px 8px; white-space: nowrap;">${eq.name}</td>
        <td style="font-weight: 800; color: var(--primary); padding: 4px;">${eq.pts}</td>
        <td style="padding: 4px;">${eq.j}</td>
        <td style="padding: 4px;">${eq.g}</td>
        <td style="padding: 4px;">${eq.n}</td>
        <td style="padding: 4px;">${eq.p}</td>
        <td style="padding: 4px; color: var(--text-muted);">${eq.bp}</td>
        <td style="padding: 4px; color: var(--text-muted);">${eq.bc}</td>
        <td style="padding: 4px; font-weight: 700;">${diff > 0 ? "+" + diff : diff}</td>
        <td style="padding: 4px 8px; white-space: nowrap;">${formeHTML || "-"}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  vueEquipes.innerHTML = html;
}

function genererClassementButeurs() {
  const joueurs = {};

  listeMatchsPoule.forEach(m => {
    if (!m.statsJoueurs) return;

    // Cartographie rapide des équipes dans ce match
    const eqMap = {};
    if (m.equipe1) eqMap[String(m.equipe1.id)] = m.equipe1.libelle;
    if (m.equipe2) eqMap[String(m.equipe2.id)] = m.equipe2.libelle;

    m.statsJoueurs.forEach(j => {
      const key = `${j.prenom}_${j.nom}_${j.equipeId}`.toLowerCase();
      const buts = parseInt(j.buts) || 0;

      if (!joueurs[key]) {
        joueurs[key] = {
          nom: `${j.prenom || ""} ${j.nom || ""}`.trim(),
          equipe: eqMap[String(j.equipeId)] || "Équipe",
          buts: 0,
          matchs: 0
        };
      }

      joueurs[key].buts += buts;
      joueurs[key].matchs += 1;
    });
  });

  const listeJoueurs = Object.values(joueurs).map(j => ({
    ...j,
    ratio: j.matchs > 0 ? (j.buts / j.matchs).toFixed(2) : 0
  }));

  listeJoueurs.sort((a, b) => {
    if (modeButeurs === "ratio") {
      return b.ratio - a.ratio || b.buts - a.buts;
    }
    return b.buts - a.buts || b.ratio - a.ratio;
  });

  let html = `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <thead>
        <tr style="background: var(--primary); color: #fff; height: 36px; font-size: 11px;">
          <th style="padding: 4px;">#</th>
          <th style="text-align: left; padding: 4px 8px;">Joueur</th>
          <th style="text-align: left; padding: 4px 8px;">Équipe</th>
          <th style="padding: 4px;">Buts</th>
          <th style="padding: 4px;">Matchs</th>
          <th style="padding: 4px;">Moy.</th>
        </tr>
      </thead>
      <tbody>
  `;

  listeJoueurs.slice(0, 50).forEach((j, index) => {
    html += `
      <tr style="border-bottom: 1px solid rgba(0,0,0,0.05); height: 36px;">
        <td style="font-weight: 800; padding: 4px;">${index + 1}</td>
        <td style="text-align: left; font-weight: 700; padding: 4px 8px; white-space: nowrap;">${j.nom}</td>
        <td style="text-align: left; color: var(--text-muted); padding: 4px 8px; white-space: nowrap;">${j.equipe}</td>
        <td style="font-weight: 800; color: var(--primary); padding: 4px;">${j.buts}</td>
        <td style="padding: 4px;">${j.matchs}</td>
        <td style="font-weight: 700; padding: 4px;">${j.ratio}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  vueButeurs.innerHTML = html;
}

/*
 * ============================================================
 * INTERACTION & BASCULES
 * ============================================================
 */
function afficherOnglet(tab) {
  if (tab === "equipes") {
    vueEquipes.style.display = "block";
    vueButeurs.style.display = "none";
    subToggleButeurs.style.display = "none";
    btnTabEquipes.style.background = "var(--primary)";
    btnTabEquipes.style.color = "#fff";
    btnTabButeurs.style.background = "transparent";
    btnTabButeurs.style.color = "var(--primary)";
  } else {
    vueEquipes.style.display = "none";
    vueButeurs.style.display = "block";
    subToggleButeurs.style.display = "flex";
    btnTabButeurs.style.background = "var(--primary)";
    btnTabButeurs.style.color = "#fff";
    btnTabEquipes.style.background = "transparent";
    btnTabEquipes.style.color = "var(--primary)";
  }
}

btnTabEquipes.addEventListener("click", () => afficherOnglet("equipes"));
btnTabButeurs.addEventListener("click", () => afficherOnglet("buteurs"));

btnSortButs.addEventListener("click", () => {
  modeButeurs = "buts";
  btnSortButs.style.background = "var(--primary)";
  btnSortRatio.style.background = "var(--text-muted)";
  genererClassementButeurs();
});

btnSortRatio.addEventListener("click", () => {
  modeButeurs = "ratio";
  btnSortRatio.style.background = "var(--primary)";
  btnSortButs.style.background = "var(--text-muted)";
  genererClassementButeurs();
});

button.addEventListener("click", explorerPoule);
input.addEventListener("keydown", e => { if (e.key === "Enter") explorerPoule(); });

// Initialisation
afficherFavorisBarre();
