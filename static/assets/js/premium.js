(() => {
  const modal = document.getElementById("premium-checkout-modal");
  const heroButton = document.getElementById("premium-hero-button");
  const planButton = document.getElementById("premium-plan-button");
  const state = document.getElementById("premium-account-state");

  const setButtonsBusy = (busy) => {
    [heroButton, planButton].forEach(button => {
      if (!button) return;
      button.disabled = busy;
      button.classList.toggle("is-loading", busy);
    });
  };

  const showMessage = (message, type = "info") => {
    if (!state) return;
    state.hidden = false;
    state.className = "premium-account-state " + type;
    state.textContent = message;
  };

  const startCheckout = async () => {
    setButtonsBusy(true);
    try {
      const response = await fetch("/api/premium/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/account?returnTo=%2Fpremium";
        return;
      }

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Could not start Premium checkout.");
      }

      window.location.href = data.url;
    } catch (error) {
      showMessage(error.message || "Could not start Premium checkout.", "error");
      setButtonsBusy(false);
    }
  };

  [heroButton, planButton].forEach(button => {
    button?.addEventListener("click", startCheckout);
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
        [heroButton, planButton].forEach(button => {
          if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>Premium active</span>';
          }
        });
      } else {
        state.textContent = "Signed in as " + (user.displayName || user.username || "your Lunar account") + ".";
      }
    })
    .catch(() => {});

  const params = new URLSearchParams(window.location.search);
  if (params.get("success") === "1") {
    showMessage("Payment received. Premium will activate as soon as Stripe confirms the subscription.", "success");
  } else if (params.get("canceled") === "1") {
    showMessage("Checkout was canceled. No Premium subscription was created.", "info");
  }

  if (window.location.hash === "#premium") {
    setTimeout(() => document.getElementById("premium-plan-title")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }
})();