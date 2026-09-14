/*
 * ============================================================
 * RENDU D'UNE ÉQUIPE
 * ============================================================
 */
function afficherEquipe(equipe, joueurs, logo = null) {

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

  const logoHTML = logo
    ? `<img src="${logo}" alt="Logo ${equipe.libelle || "équipe"}" style="width: 48px; height: 48px; object-fit: contain; flex-shrink: 0;">`
    : `<div class="card-icon"><i class="ri-team-line"></i></div>`;

  return `
    <div class="card">
      <div class="card-header">
        ${logoHTML}
        <div class="card-title">
          <div style="font-size: 16px; font-weight: 800;">
            ${equipe.libelle || "Équipe"}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); font-weight: 500;">
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
 * RENDU DU MATCH COMPLET ET BANNIÈRE SCORE
 * ============================================================
 */
function afficherMatch(data) {

  resultats.innerHTML = "";

  if (!data || !data.statsJoueurs || !data.equipe1 || !data.equipe2) {
    throw new Error("Structure de données de match incomplète.");
  }

  /* Logos */
  const logoEquipe1 = data.score?.home?.flag?.url || null;
  const logoEquipe2 = data.score?.away?.flag?.url || null;

  /* Scores généraux (depuis le composant score s'il existe, sinon calcul via le cumul des buts) */
  const scoreEquipe1 = data.score?.home?.score ?? data.statsJoueurs
    .filter(j => String(j.equipeId) === String(data.equipe1.id))
    .reduce((t, j) => t + (parseInt(j.buts) || 0), 0);

  const scoreEquipe2 = data.score?.away?.score ?? data.statsJoueurs
    .filter(j => String(j.equipeId) === String(data.equipe2.id))
    .reduce((t, j) => t + (parseInt(j.buts) || 0), 0);

  const logoHTML1 = logoEquipe1 
    ? `<img src="${logoEquipe1}" alt="Logo ${data.equipe1.libelle}" style="width: 52px; height: 52px; object-fit: contain;">`
    : `<div class="card-icon" style="margin: 0;"><i class="ri-team-line"></i></div>`;

  const logoHTML2 = logoEquipe2 
    ? `<img src="${logoEquipe2}" alt="Logo ${data.equipe2.libelle}" style="width: 52px; height: 52px; object-fit: contain;">`
    : `<div class="card-icon" style="margin: 0;"><i class="ri-team-line"></i></div>`;

  /* Bannières du Match */
  const matchHeaderHTML = `
    <div class="card" style="margin-bottom: 20px; text-align: center;">
      <div style="display: flex; align-items: center; justify-content: space-around; gap: 12px;">
        
        <!-- Équipe 1 -->
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
          ${logoHTML1}
          <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary); line-height: 1.2;">
            ${data.equipe1.libelle || "Équipe 1"}
          </div>
        </div>

        <!-- Score Central -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 90px;">
          <div style="font-size: 26px; font-weight: 800; color: var(--primary); letter-spacing: 1px;">
            ${scoreEquipe1} : ${scoreEquipe2}
          </div>
          <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">
            Score final
          </span>
        </div>

        <!-- Équipe 2 -->
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
          ${logoHTML2}
          <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary); line-height: 1.2;">
            ${data.equipe2.libelle || "Équipe 2"}
          </div>
        </div>

      </div>
    </div>
  `;

  /* Affichage de la bannière + cartes joueurs */
  resultats.innerHTML = `
    ${matchHeaderHTML}

    <div class="section-header">
      <div class="section-title">
        Détail des joueurs
      </div>
    </div>

    ${afficherEquipe(data.equipe1, data.statsJoueurs, logoEquipe1)}
    ${afficherEquipe(data.equipe2, data.statsJoueurs, logoEquipe2)}
  `;
}
