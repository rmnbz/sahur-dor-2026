
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rslppnagjuczhhkqcedc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_41I0pcP7yCQ7PBn4-VeyrQ_pUrFg83s";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const grid = document.getElementById("candidateGrid");
const choices = document.getElementById("voteChoices");
const statusBox = document.getElementById("voteStatus");
const submit = document.getElementById("submitVote");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");

let selectedId = null;
let currentUser = null;
let alreadyVoted = false;
let isServerMember = false;
let checkingMembership = false;
let refreshInFlight = null;
let membershipInFlight = null;

function status(message) {
  statusBox.textContent = message;
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
    button.innerHTML = "<b></b><small></small>";

    button.querySelector("b").textContent = n.name;
    button.querySelector("small").textContent = n.position;

    button.addEventListener("click", () => {
      if (!currentUser || !isServerMember || alreadyVoted || checkingMembership) {
        return;
      }

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

    if (!currentUser) {
      status("Connectez-vous avec Discord pour accéder au vote.");
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

    status(
      alreadyVoted
        ? "Votre vote a déjà été enregistré. Merci pour votre participation !"
        : "Membre de Bust Academy vérifié ! Choisissez votre favori."
    );
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

  if (error) {
    status("Connexion Discord impossible : " + error.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  isServerMember = false;
  selectedId = null;
  submit.disabled = true;
  await refreshSession();
});

submit.addEventListener("click", async () => {
  if (
    !currentUser ||
    !selectedId ||
    alreadyVoted ||
    !isServerMember ||
    checkingMembership
  ) {
    return;
  }

  const nomineeId = selectedId;
  const userId = currentUser.id;

  submit.disabled = true;
  status("Nouvelle vérification de votre appartenance au serveur...");

  const stillMember = await checkMembership();

  if (!stillMember) {
    isServerMember = false;
    selectedId = null;
    status("Vérification impossible ou accès refusé. Réessayez dans quelques instants.");
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

  status(
    "Votre vote est bien enregistré. Les résultats restent secrets jusqu'à la cérémonie !"
  );
});

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
    refreshSession();
  }
});

await loadNominees();
await refreshSession();
