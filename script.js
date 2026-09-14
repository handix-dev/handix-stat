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


  /*
   * ------------------------------------------------------------
   * Composant joueurs
   * ------------------------------------------------------------
   */
  const joueursComponent = doc.querySelector(
    'smartfire-component[name="competitions---rencontre-liste-joueurs"]'
  );

  if (!joueursComponent) {
    throw new Error(
      "Le composant des statistiques joueurs est introuvable sur la page."
    );
  }


  let attributesJoueurs = joueursComponent.getAttribute("attributes");

  if (!attributesJoueurs) {
    throw new Error("Les données du match sont vides.");
  }


  /*
   * Décodage des entités HTML
   */
  const textareaJoueurs = document.createElement("textarea");

  textareaJoueurs.innerHTML = attributesJoueurs;

  attributesJoueurs = textareaJoueurs.value;


  let joueursData;

  try {

    joueursData = JSON.parse(attributesJoueurs);

  } catch (error) {

    console.error("JSON joueurs brut :", attributesJoueurs);

    throw new Error(
      "Impossible d'analyser le format JSON des joueurs."
    );
  }


  /*
   * ------------------------------------------------------------
   * Composant score / logos
   * ------------------------------------------------------------
   */
  const scoreComponent = doc.querySelector(
    'smartfire-component[name="competitions---competition-score"]'
  );

  let scoreData = null;


  if (scoreComponent) {

    let attributesScore = scoreComponent.getAttribute("attributes");

    if (attributesScore) {

      const textareaScore = document.createElement("textarea");

      textareaScore.innerHTML = attributesScore;

      attributesScore = textareaScore.value;


      try {

        scoreData = JSON.parse(attributesScore);

      } catch (error) {

        console.warn(
          "Impossible de lire les données du composant score.",
          error
        );

      }
    }
  }


  /*
   * ------------------------------------------------------------
   * Retour des données combinées
   * ------------------------------------------------------------
   */
  return {
    ...joueursData,
    score: scoreData
  };
}


/*
 * ============================================================
 * RENDU D'UNE ÉQUIPE
 * ============================================================
 */
function afficherEquipe(equipe, joueurs, logo = null) {

  const joueursEquipe = joueurs.filter(
    joueur =>
      String(joueur.equipeId) === String(equipe.id)
  );


  joueursEquipe.sort((a, b) => {

    const numeroA = parseInt(a.numero) || 999;
    const numeroB = parseInt(b.numero) || 999;

    return numeroA - numeroB;

  });


  const totalButs = joueursEquipe.reduce(
    (total, joueur) => {

      return total + (parseInt(joueur.buts) || 0);

    },
    0
  );


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
      <div style="
        text-align: center;
        color: var(--text-muted);
        padding: 12px;
        font-size: 14px;
      ">
        Aucun joueur répertorié.
      </div>
    `;
  }


  /*
   * ------------------------------------------------------------
   * Logo de l'équipe
   * ------------------------------------------------------------
   */
  const logoHTML = logo
    ? `
      <img
        src="${logo}"
        alt="Logo ${equipe.libelle || "équipe"}"
        style="
          width: 48px;
          height: 48px;
          object-fit: contain;
          flex-shrink: 0;
        "
      >
    `
    : `
      <div class="card-icon">
        <i class="ri-team-line"></i>
      </div>
    `;


  return `
    <div class="card">

      <div class="card-header">

        ${logoHTML}

        <div class="card-title">

          <div style="
            font-size: 16px;
            font-weight: 800;
          ">
            ${equipe.libelle || "Équipe"}
          </div>

          <div style="
            font-size: 12px;
            color: var(--text-muted);
            font-weight: 500;
          ">
            ${joueursEquipe.length} joueur(s)
          </div>

        </div>

        <div class="card-badge">
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


  if (
    !data ||
    !data.statsJoueurs ||
    !data.equipe1 ||
    !data.equipe2
  ) {

    throw new Error(
      "Structure de données de match incomplète."
    );
  }


  /*
   * ------------------------------------------------------------
   * Récupération des logos
   * ------------------------------------------------------------
   */
  const logoEquipe1 =
    data.score?.home?.flag?.url || null;

  const logoEquipe2 =
    data.score?.away?.flag?.url || null;


  /*
   * ------------------------------------------------------------
   * Affichage
   * ------------------------------------------------------------
   */
  resultats.innerHTML = `

    <div class="section-header">
      <div class="section-title">
        Feuille de match
      </div>
    </div>

    ${afficherEquipe(
      data.equipe1,
      data.statsJoueurs,
      logoEquipe1
    )}

    ${afficherEquipe(
      data.equipe2,
      data.statsJoueurs,
      logoEquipe2
    )}

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

    afficherStatus(
      "Collez l'URL d'un match FFHandball.",
      "error"
    );

    return;
  }


  if (!verifierUrl(matchUrl)) {

    afficherStatus(
      "L'URL doit être une URL FFHandball valide.",
      "error"
    );

    return;
  }


  button.disabled = true;

  afficherStatus(
    "Chargement des statistiques...",
    "loading"
  );


  try {

    const proxyUrl =
      WORKER_URL +
      "?url=" +
      encodeURIComponent(matchUrl);


    const response = await fetch(proxyUrl);


    if (!response.ok) {

      const erreur = await response.text();

      throw new Error(
        "Erreur Worker HTTP " +
        response.status +
        " : " +
        erreur.substring(0, 200)
      );
    }


    const html = await response.text();


    if (!html) {

      throw new Error(
        "La réponse reçue est vide."
      );
    }


    /*
     * Extraction des statistiques + logos
     */
    const data = extraireDonnees(html);


    /*
     * Debug temporaire
     */
    console.log("Données match :", data);
    console.log(
      "Logo équipe 1 :",
      data.score?.home?.flag?.url
    );
    console.log(
      "Logo équipe 2 :",
      data.score?.away?.flag?.url
    );


    afficherMatch(data);


    afficherStatus(
      "Statistiques chargées avec succès !",
      "success"
    );


  } catch (error) {

    console.error(error);

    afficherStatus(
      "Erreur : " + error.message,
      "error"
    );

    debug.style.display = "block";

    debug.textContent =
      error.stack || error.message;


  } finally {

    button.disabled = false;

  }
}


/*
 * ============================================================
 * ÉVÉNEMENTS
 * ============================================================
 */
button.addEventListener(
  "click",
  analyserMatch
);


input.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {

      analyserMatch();

    }

  }
);
