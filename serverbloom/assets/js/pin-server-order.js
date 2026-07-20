(() => {
  "use strict";

  const ONLY_FOR_GAME_IDS = new Set([
    "onlyforgame",
    "only-for-game"
  ]);

  const ONLY_FOR_GAME_NAMES = new Set([
    "only for game"
  ]);

  const RED_INN_NAMES = new Set([
    "紅塵客棧"
  ]);

  function normalize(value) {
    return String(value || "")
      .replace(/◆/g, "")
      .trim()
      .toLowerCase();
  }

  function getServerId(card) {
    return normalize(
      card?.dataset?.serverId
    );
  }

  function getServerName(card) {
    const title =
      card?.querySelector(".identity h3");

    return normalize(
      title?.textContent
    );
  }

  function isOnlyForGame(card) {
    const id = getServerId(card);
    const name = getServerName(card);

    return (
      ONLY_FOR_GAME_IDS.has(id) ||
      ONLY_FOR_GAME_NAMES.has(name)
    );
  }

  function isRedInn(card) {
    const name = getServerName(card);

    return RED_INN_NAMES.has(name);
  }

  function createOrderedCards(cards) {
    const onlyForGame =
      cards.find(isOnlyForGame);

    const redInn =
      cards.find(isRedInn);

    const remaining = cards.filter(
      card =>
        card !== onlyForGame &&
        card !== redInn
    );

    return [
      ...(onlyForGame
        ? [onlyForGame]
        : []),

      ...(redInn
        ? [redInn]
        : []),

      ...remaining
    ];
  }

  function reorderServerCards(grid) {
    const cards = Array.from(
      grid.querySelectorAll(
        ":scope > .card"
      )
    );

    if (cards.length < 2) {
      return;
    }

    const orderedCards =
      createOrderedCards(cards);

    const needsReorder =
      orderedCards.some(
        (card, index) =>
          grid.children[index] !== card
      );

    if (!needsReorder) {
      return;
    }

    orderedCards.forEach(card => {
      /*
        移動的是完整 article.card 節點。

        因此以下內容全部會一起移動：
        - Server Name
        - Tags
        - Introduction / Description
        - Banner
        - Avatar / Icon
        - Category
        - Member Count
        - Online Count
        - Invite URL
        - Share Button
        - Details Button
        - Server Colors

        不會拆開資料，也不會和其他伺服器混在一起。
      */
      grid.appendChild(card);
    });
  }

  function startPinnedServerOrder() {
    const grid =
      document.querySelector(
        "#serverGrid"
      );

    if (!grid) {
      console.warn(
        "ServerBloom：找不到 #serverGrid，固定排序未啟動。"
      );

      return;
    }

    let scheduled = false;

    function scheduleReorder() {
      if (scheduled) {
        return;
      }

      scheduled = true;

      requestAnimationFrame(() => {
        scheduled = false;
        reorderServerCards(grid);
      });
    }

    const observer =
      new MutationObserver(
        mutations => {
          const hasCardChanges =
            mutations.some(
              mutation =>
                mutation.type ===
                  "childList" &&
                (
                  mutation.addedNodes
                    .length > 0 ||
                  mutation.removedNodes
                    .length > 0
                )
            );

          if (hasCardChanges) {
            scheduleReorder();
          }
        }
      );

    observer.observe(grid, {
      childList: true
    });

    scheduleReorder();

    window.addEventListener(
      "serverbloom:servers-rendered",
      scheduleReorder
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startPinnedServerOrder,
      {
        once: true
      }
    );
  } else {
    startPinnedServerOrder();
  }
})();
