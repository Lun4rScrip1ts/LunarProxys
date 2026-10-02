(() => {
  const player = document.getElementById("spotify-floating-player");
  const popout = document.getElementById("spotify-popout");
  const frame = document.getElementById("spotify-floating-frame");
  if (!player || !popout || !frame) return;

  let poppedOut = false;

  const setPopout = enabled => {
    poppedOut = Boolean(enabled);
    player.classList.toggle("spotify-frameless-popout", poppedOut);
    popout.setAttribute("aria-pressed", String(poppedOut));
    popout.title = poppedOut ? "Restore floating player" : "Pop out player";
    const icon = popout.querySelector("i");
    if (icon) icon.className = poppedOut ? "fa-solid fa-down-left-and-up-right-to-center" : "fa-solid fa-up-right-from-square";
  };

  // Capture the click before spotify.js can call window.open().
  popout.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    setPopout(!poppedOut);
  }, true);

  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && poppedOut && !player.hidden) {
      setPopout(false);
    }
  });

  window.addEventListener("resize", () => {
    if (!poppedOut) return;
    player.style.left = "50%";
    player.style.top = "50%";
    player.style.right = "auto";
    player.style.bottom = "auto";
  });
})();
