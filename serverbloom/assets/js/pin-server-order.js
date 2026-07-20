(() => {
  "use strict";

  function cleanText(value) {
    return String(value || "")
      .replace(/◆/g, "")
      .trim()
      .toLowerCase();
  }

  function getCardName(card) {
    const heading = card.querySelector(".identity h3");
    return cleanText(heading?.textContent);
  }

  function reorderCards() {
    const grid = document.querySelector("#serverGrid");

    if (!grid) {
      return;
    }

    const cards = Array.from(
      grid.querySelectorAll(":scope > .card")
    );

    if (!cards.length) {
      return;
    }

    const onlyForGame = cards.find(card => {
      const name = getCardName(card);

      return (
        name === "only for game" ||
        cleanText(card.dataset.serverId) === "onlyforgame" ||
        cleanText(card.dataset.serverId) === "only-for-game"
      );
    });

    const redInn = cards.find(card => {
      return getCardName(card) === "紅塵客棧";
    });

    const others = cards.filter(card => {
      return card !== onlyForGame && card !== redInn;
    });

    const ordered = [
      ...(onlyForGame ? [onlyForGame] : []),
      ...(redInn ? [redInn] : []),
      ...others
    ];

    ordered.forEach(card => {
      grid.appendChild(card);
    });
  }

  function start() {
    const grid = document.querySelector("#serverGrid");

    if (!grid) {
      setTimeout(start, 300);
      return;
    }

    let timer = null;

    const schedule = () => {
      clearTimeout(timer);

      timer = setTimeout(() => {
        reorderCards();
      }, 50);
    };

    const observer = new MutationObserver(schedule);

    observer.observe(grid, {
      childList: true
    });

    schedule();

    setTimeout(reorderCards, 500);
    setTimeout(reorderCards, 1500);
    setTimeout(reorderCards, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  } else {
    start();
  }
})();
