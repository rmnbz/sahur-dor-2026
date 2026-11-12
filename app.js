
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rslppnagjuczhhkqcedc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_41I0pcP7yCQ7PBn4-VeyrQ_pUrFg83s";
const ADMIN_ID = "16e052f9-beec-4150-a6ad-a08c4b2c2e6c";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const grid = document.getElementById("candidateGrid");
const choices = document.getElementById("voteChoices");
const statusBox = document.getElementById("voteStatus");
const submit = document.getElementById("submitVote");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");

const adminPanel = document.getElementById("adminPanel");
const adminVoteStatus = document.getElementById("adminVoteStatus");
const adminMessage = document.getElementById("adminMessage");
const openVotesBtn = document.getElementById("openVotesBtn");
const closeVotesBtn = document.getElementById("closeVotesBtn");

const adminRevealStatus = document.getElementById("adminRevealStatus");
const revealResultsBtn = document.getElementById("revealResultsBtn");
const revealMessage = document.getElementById("revealMessage");
const resultsSection = document.getElementById("resultsSection");
const podium = document.getElementById("podium");
const resultsList = document.getElementById("resultsList");

let selectedId = null;
let currentUser = null;
let alreadyVoted = false;
let isServerMember = false;
let checkingMembership = false;
let votingOpen = true;
let resultsRevealed = false;
let refreshInFlight = null;
let membershipInFlight = null;
let updatingSettings = false;
let revealingResults = false;

function status(message) {
  statusBox.textContent = message;
}

function isAdmin() {
  return currentUser?.id === ADMIN_ID;
}

async function loadVoteSettings() {
  const { data, error } = await supabase
    .from("vote_settings")
    .select("voting_open")
    .eq("id", true)
    .single();

  if (error || !data) {
    console.error("Erreur réglages votes :", error);
    return false;
  }

  votingOpen = data.voting_open === true;
  return true;
}

async function loadCeremonySettings() {
  const { data, error } = await supabase
    .from("ceremony_settings")
    .select("results_revealed")
    .eq("id", true)
    .single();

  if (error || !data) {
    console.error("Erreur réglages cérémonie :", error);
    return false;
  }

  resultsRevealed = data.results_revealed === true;
  return true;
}

function updateAdminDisplay() {
  if (!isAdmin()) {
    adminPanel.hidden = true;
    return;
  }

  adminPanel.hidden = false;

  adminVoteStatus.textContent = votingOpen
    ? "🟢 SCRUTIN OUVERT"
    : "🔴 SCRUTIN FERMÉ";

  openVotesBtn.disabled = votingOpen || updatingSettings;
  closeVotesBtn.disabled = !votingOpen || updatingSettings;

  adminRevealStatus.textContent = resultsRevealed
    ? "🏆 Les résultats ont été officiellement révélés."
    : "🔒 Les résultats sont encore secrets.";

  revealResultsBtn.disabled =
    votingOpen || resultsRevealed || revealingResults;

  revealResultsBtn.textContent = resultsRevealed
    ? "RÉSULTATS DÉJÀ RÉVÉLÉS"
    : "🏆 RÉVÉLER LES RÉSULTATS";
}

async function checkMembership() {
  if (membershipInFlight) return membershipInFlight;

  membershipInFlight = (async () => {
    const { data, error } = await supabase.functions.invoke(
      "check-discord-membership"
    );

    if (error) {
      console.error("Membership verification:", error);
      return false;
    }

    return data?.authorized === true;
  })();

  try {
    return await membershipInFlight;
  } finally {
    membershipInFlight = null;
  }
}

async function loadResults() {
  const { data, error } = await supabase.rpc("get_ceremony_results");

  if (error) {
    console.error("Erreur résultats :", error);
    resultsSection.hidden = true;
    return;
  }

  if (!data || data.length === 0) {
    resultsSection.hidden = false;
    podium.textContent = "Aucun vote enregistré.";
    resultsList.replaceChildren();
    return;
  }

  resultsSection.hidden = false;
  podium.replaceChildren();
  resultsList.replaceChildren();

  const medals = ["🥇", "🥈", "🥉"];
  const podiumColors = ["#d9ad4b", "#bfc4ca", "#b77b45"];

  data.slice(0, 3).forEach((candidate, index) => {
    const card = document.createElement("div");

    card.style.cssText = `
      flex:1;
      min-width:180px;
      max-width:260px;
      padding:25px 15px;
      background:#171512;
      border:1px solid ${podiumColors[index]};
      border-radius:12px;
      color:white;
      text-align:center;
    `;

    const medal = document.createElement("div");
    medal.style.fontSize = "38px";
    medal.textContent = medals[index];

    const rank = document.createElement("h3");
    rank.style.color = podiumColors[index];
    rank.textContent = ["1ER", "2E", "3E"][index];

    const name = document.createElement("h2");
    name.textContent = candidate.nominee_name;

    const position = document.createElement("p");
    position.textContent = candidate.nominee_position;

    const votes = document.createElement("strong");
    votes.textContent = `${candidate.vote_count} vote(s)`;

    card.append(medal, rank, name, position, votes);
    podium.appendChild(card);
  });

  data.forEach((candidate, index) => {
    const row = document.createElement("div");

    row.style.cssText = `
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      padding:15px;
      margin:8px 0;
      background:#171512;
      border:1px solid #5b4727;
      border-radius:8px;
      color:white;
      text-align:left;
    `;

    const name = document.createElement("span");
    name.textContent = `${index + 1}. ${candidate.nominee_name} — ${candidate.nominee_position}`;

    const votes = document.createElement("strong");
    votes.style.color = "#d9ad4b";
    votes.textContent = `${candidate.vote_count} voix`;

    row.append(name, votes);
    resultsList.appendChild(row);
  });
}

async function refreshVoteStatus() {
  const loaded = await loadVoteSettings();

  if (!loaded) {
    status("Impossible de récupérer le statut du scrutin.");
    submit.disabled = true;
    return;
  }

  updateAdminDisplay();

  if (!votingOpen) {
    selectedId = null;
    submit.disabled = true;

    choices.querySelectorAll(".choice").forEach((button) => {
      button.classList.remove("selected");
      button.disabled = true;
    });

    status("🔒 Les votes sont actuellement fermés.");
    return;
  }

  choices.querySelectorAll(".choice").forEach((button) => {
    button.disabled = !isServerMember || alreadyVoted;
  });

  if (isServerMember && !alreadyVoted) {
    status("Membre de Bust Academy vérifié ! Choisissez votre favori.");
  }
}

async function changeVotingStatus(open) {
  if (!isAdmin() || updatingSettings) return;

  updatingSettings = true;
  updateAdminDisplay();
  adminMessage.textContent = "Enregistrement en cours...";

  const { error } = await supabase
    .from("vote_settings")
    .update({ voting_open: open })
    .eq("id", true);

  if (error) {
    adminMessage.textContent = "Erreur : " + error.message;
  } else {
    adminMessage.textContent = open
      ? "Les votes sont maintenant ouverts."
      : "Les votes sont maintenant fermés.";

    await loadVoteSettings();
    await refreshVoteStatus();
  }

  updatingSettings = false;
  updateAdminDisplay();
}

async function revealResults() {
  if (!isAdmin() || revealingResults || resultsRevealed) return;

  if (votingOpen) {
    revealMessage.textContent =
      "Ferme d'abord le scrutin avant de révéler les résultats.";
    return;
  }

  const confirmed = confirm(
    "ATTENTION : cette action va révéler publiquement les résultats du Sahur d'Or 2026. Continuer ?"
  );

  if (!confirmed) return;

  revealingResults = true;
  updateAdminDisplay();
  revealMessage.textContent = "Vérification et révélation en cours...";

  const settingsLoaded = await loadVoteSettings();

  if (!settingsLoaded || votingOpen) {
    revealMessage.textContent =
      "Impossible de révéler : le scrutin doit être fermé.";
    revealingResults = false;
    updateAdminDisplay();
    return;
  }

  const { error } = await supabase
    .from("ceremony_settings")
    .update({ results_revealed: true })
    .eq("id", true);

  if (error) {
    revealMessage.textContent = "Erreur : " + error.message;
    revealingResults = false;
    updateAdminDisplay();
    return;
  }

  await loadCeremonySettings();

  if (!resultsRevealed) {
    revealMessage.textContent =
      "La révélation n'a pas pu être confirmée.";
    revealingResults = false;
    updateAdminDisplay();
    return;
  }

  await loadResults();

  revealMessage.textContent =
    "🏆 Les résultats du Sahur d'Or 2026 sont maintenant publics !";

  revealingResults = false;
  updateAdminDisplay();

  resultsSection.scrollIntoView({ behavior: "smooth" });
}

function renderNominees(rows) {
  grid.replaceChildren();
  choices.replaceChildren();

  rows.forEach((n) => {
    const card = document.createElement("article");
    card.className = "candidate";
    card.innerHTML = `
      <div class="candidate-top">
        <span class="position"></span>
        <span style="color:#d9ad4b">✦</span>
      </div>
      <h3></h3>
      <p>NOMINÉ AU SAHUR D’OR 2026</p>
    `;

    card.querySelector(".position").textContent = n.position;
    card.querySelector("h3").textContent = n.name;
    grid.appendChild(card);

    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.innerHTML = "<b></b><small></small>";

    button.querySelector("b").textContent = n.name;
    button.querySelector("small").textContent = n.position;

    button.addEventListener("click", () => {
      if (
        !currentUser ||
        !isServerMember ||
        alreadyVoted ||
        !votingOpen ||
        checkingMembership
      ) return;

      selectedId = n.id;

      choices.querySelectorAll(".choice").forEach((x) => {
        x.classList.remove("selected");
      });

      button.classList.add("selected");
      submit.disabled = false;
    });

    choices.appendChild(button);
  });
}

async function loadNominees() {
  const { data, error } = await supabase
    .from("nominees")
    .select("id,name,position,display_order")
    .order("display_order");

  if (error) {
    status("Impossible de charger les nominés : " + error.message);
    return;
  }

  renderNominees(data || []);
}

async function refreshSession() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    currentUser = session?.user || null;

    loginBtn.hidden = !!currentUser;
    logoutBtn.hidden = !currentUser;

    userLabel.textContent = currentUser
      ? currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        "Connecté avec Discord"
      : "";

    selectedId = null;
    alreadyVoted = false;
    isServerMember = false;
    submit.disabled = true;

    updateAdminDisplay();

    const ceremonyLoaded = await loadCeremonySettings();

    if (!ceremonyLoaded) {
      console.error("Impossible de charger la configuration cérémonie.");
    }

    if (resultsRevealed) {
      await loadResults();
    } else {
      resultsSection.hidden = true;
    }

    if (!currentUser) {
      adminPanel.hidden = true;
      status("Connectez-vous avec Discord pour accéder au vote.");
      return;
    }

    const settingsLoaded = await loadVoteSettings();

    if (!settingsLoaded) {
      status("Impossible de récupérer le statut du scrutin.");
      return;
    }

    updateAdminDisplay();

    if (!votingOpen) {
      status("🔒 Les votes sont actuellement fermés.");
      return;
    }

    checkingMembership = true;
    status("Vérification de votre appartenance à Bust Academy...");

    try {
      isServerMember = await checkMembership();
    } finally {
      checkingMembership = false;
    }

    if (!isServerMember) {
      status("Vérification impossible ou accès refusé. Réessayez dans quelques instants.");
      return;
    }

    const { data, error } = await supabase
      .from("votes")
      .select("id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) {
      status("Impossible de vérifier votre bulletin : " + error.message);
      return;
    }

    alreadyVoted = !!data;

    if (alreadyVoted) {
      status("Votre vote a déjà été enregistré. Merci pour votre participation !");
    } else {
      status("Membre de Bust Academy vérifié ! Choisissez votre favori.");
    }

    choices.querySelectorAll(".choice").forEach((button) => {
      button.disabled = alreadyVoted;
    });
  })();

  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

loginBtn.addEventListener("click", async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) status("Connexion Discord impossible : " + error.message);
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  isServerMember = false;
  selectedId = null;
  submit.disabled = true;
  await refreshSession();
});

openVotesBtn.addEventListener("click", () => {
  if (confirm("Confirmer l'ouverture des votes ?")) {
    changeVotingStatus(true);
  }
});

closeVotesBtn.addEventListener("click", () => {
  if (confirm("Confirmer la fermeture des votes ?")) {
    changeVotingStatus(false);
  }
});

revealResultsBtn.addEventListener("click", revealResults);

submit.addEventListener("click", async () => {
  if (
    !currentUser ||
    !selectedId ||
    alreadyVoted ||
    !isServerMember ||
    !votingOpen ||
    checkingMembership
  ) return;

  const nomineeId = selectedId;
  const userId = currentUser.id;

  if (!confirm("Ton vote sera définitif. Confirmer ton choix ?")) return;

  submit.disabled = true;
  status("Nouvelle vérification de votre appartenance au serveur...");

  const settingsLoaded = await loadVoteSettings();

  if (!settingsLoaded || !votingOpen) {
    selectedId = null;
    status("Les votes sont fermés ou leur statut est indisponible.");
    await refreshVoteStatus();
    return;
  }

  const stillMember = await checkMembership();

  if (!stillMember) {
    isServerMember = false;
    selectedId = null;
    status("Vérification impossible ou accès refusé.");
    return;
  }

  const { error } = await supabase
    .from("votes")
    .insert({
      user_id: userId,
      nominee_id: nomineeId
    });

  if (error) {
    status(
      error.code === "23505"
        ? "Un vote existe déjà pour ce compte Discord."
        : "Vote non enregistré : " + error.message
    );
    submit.disabled = false;
    return;
  }

  alreadyVoted = true;
  selectedId = null;

  status("Votre vote est bien enregistré. Les résultats restent secrets jusqu'à la cérémonie !");

  choices.querySelectorAll(".choice").forEach((button) => {
    button.disabled = true;
    button.classList.remove("selected");
  });
});

supabase.auth.onAuthStateChange((event) => {
  if (
    event === "SIGNED_IN" ||
    event === "SIGNED_OUT" ||
    event === "USER_UPDATED"
  ) {
    refreshSession();
  }
});

await loadNominees();
await refreshSession();
