(() => {
  const modal = document.getElementById("premium-checkout-modal");
  const heroButton = document.getElementById("premium-hero-button");
  const planButton = document.getElementById("premium-plan-button");
  const state = document.getElementById("premium-account-state");

  const openModal = () => {
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("premium-modal-open");
  };

  const closeModal = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("premium-modal-open");
  };

  [heroButton, planButton].forEach(button => {
    button?.addEventListener("click", openModal);
  });

  document.querySelectorAll("[data-close-premium-modal]").forEach(button => {
    button.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal && !modal.hidden) closeModal();
  });

  fetch("/api/auth/me", { credentials: "same-origin" })
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      const user = data?.user;
      if (!user || !state) return;

      const isPremium = Boolean(user.premium || user.isPremium || user.premiumStatus === "active");
      state.hidden = false;

      if (isPremium) {
        state.classList.add("is-premium");
        state.innerHTML = '<i class="fa-solid fa-circle-check"></i> You already have Lunar Premium.';
        if (heroButton) {
          heroButton.innerHTML = '<i class="fa-solid fa-crown"></i><span>Premium active</span>';
        }
        if (planButton) {
          planButton.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>Premium active</span>';
        }
      } else {
        state.textContent = "Signed in as " + (user.displayName || user.username || "your Lunar account") + ".";
      }
    })
    .catch(() => {});

  if (window.location.hash === "#premium") {
    setTimeout(() => document.getElementById("premium-plan-title")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }
})();