(() => {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbz1xFVctSyveh82R-qMZSKwD78H9RYsoDU7l_XP3avBBiEVOOqOeM3d9D5XKkFLrlLZ/exec";

  const STATIC_POSTS_URL =
    "data/posts.json";

  const postMeta =
    document.querySelector("#postMeta");

  const postTitle =
    document.querySelector("#postTitle");

  const postAuthor =
    document.querySelector("#postAuthor");

  const postContent =
    document.querySelector("#postContent");

  const relatedList =
    document.querySelector("#relatedList");

  const shareButton =
    document.querySelector("#shareButton");

  const reportButton =
    document.querySelector("#reportButton");

  const commentForm =
    document.querySelector("#commentForm");

  const commentList =
    document.querySelector("#commentList");

  const modeIcons = {
    "呵護模式": "🟡",
    "陪伴模式": "🌸",
    "建議模式": "💜",
    "討論模式": "🟣",
    "只想說說": "⚫"
  };

  const reactionEmojis = {
    cool: "😎",
    smile: "😊",
    love: "❤️",
    angry: "🤬",
    hug: "💕",
    skull: "💀"
  };

  const reactionNames =
    Object.keys(reactionEmojis);

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]
    );
  }

  function formatDate(value) {
    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "時間未公開";
    }

    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(date);
  }

  function wait(milliseconds) {
    return new Promise(resolve => {
      window.setTimeout(
        resolve,
        milliseconds
      );
    });
  }

  function getVisitorId() {
    const storageKey =
      "serverbloomAnonymousVisitorId";

    let visitorId =
      localStorage.getItem(
        storageKey
      );

    if (!visitorId) {
      visitorId =
        "visitor-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 12);

      localStorage.setItem(
        storageKey,
        visitorId
      );
    }

    return visitorId;
  }

  function loadJsonp(url) {
    return new Promise(
      (resolve, reject) => {
        const callbackName =
          "serverbloomJsonp_" +
          Date.now() +
          "_" +
          Math.random()
            .toString(36)
            .slice(2);

        const script =
          document.createElement(
            "script"
          );

        const timeout =
          window.setTimeout(() => {
            cleanup();

            reject(
              new Error(
                "雲端資料讀取逾時"
              )
            );
          }, 12000);

        function cleanup() {
          window.clearTimeout(
            timeout
          );

          delete window[
            callbackName
          ];

          script.remove();
        }

        window[callbackName] =
          data => {
            cleanup();
            resolve(data);
          };

        const separator =
          url.includes("?")
            ? "&"
            : "?";

        script.src =
          url +
          separator +
          "callback=" +
          encodeURIComponent(
            callbackName
          );

        script.onerror = () => {
          cleanup();

          reject(
            new Error(
              "無法連接雲端資料庫"
            )
          );
        };

        document.body.appendChild(
          script
        );
      }
    );
  }

  async function readStaticPosts() {
    try {
      const response = await fetch(
        STATIC_POSTS_URL,
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        return [];
      }

      const data =
        await response.json();

      return Array.isArray(data)
        ? data
        : [];

    } catch (error) {
      console.error(
        "本地文章讀取失敗：",
        error
      );

      return [];
    }
  }

  async function readCloudPosts() {
    try {
      const result =
        await loadJsonp(
          API_URL +
          "?action=listPosts&limit=200"
        );

      return Array.isArray(
        result?.posts
      )
        ? result.posts
        : [];

    } catch (error) {
      console.error(
        "雲端文章讀取失敗：",
        error
      );

      return [];
    }
  }

  function mergePosts(
    staticPosts,
    cloudPosts
  ) {
    const postMap = new Map();

    staticPosts.forEach(post => {
      if (post?.postId) {
        postMap.set(
          String(post.postId),
          post
        );
      }
    });

    cloudPosts.forEach(post => {
      if (post?.postId) {
        postMap.set(
          String(post.postId),
          post
        );
      }
    });

    return [
      ...postMap.values()
    ];
  }

  function showError(message) {
    if (postMeta) {
      postMeta.innerHTML = `
        <span class="card-label">
          載入失敗
        </span>
      `;
    }

    if (postTitle) {
      postTitle.textContent =
        "找不到這篇匿名文章";
    }

    if (postAuthor) {
      postAuthor.textContent = "";
    }

    if (postContent) {
      postContent.textContent =
        message;
    }

    if (relatedList) {
      relatedList.innerHTML = `
        <div class="loading-message">
          暫時無法載入其他文章。
        </div>
      `;
    }
  }

  function renderCurrentPost(post) {
    const mode = String(
      post.interactionMode ||
      "討論模式"
    );

    const icon =
      modeIcons[mode] ||
      "🌸";

    postMeta.innerHTML = `
      <span class="card-label">
        ${icon}
        ${escapeHtml(mode)}
      </span>

      <span class="card-label">
        ${escapeHtml(
          post.category ||
          "其他"
        )}
      </span>
    `;

    postTitle.textContent =
      post.title ||
      "未命名匿名文章";

    postAuthor.textContent = `${
      post.nickname ||
      "匿名使用者"
    }・${formatDate(
      post.publishedAt
    )}`;

    postContent.textContent =
      post.content ||
      "這篇文章沒有內容。";

    document.title =
      `${
        post.title ||
        "匿名文章"
      }｜ServerBloom`;

    document.body.dataset.theme =
      post.theme ||
      "pink-lavender";

    if (
      mode === "只想說說"
    ) {
      if (commentForm) {
        commentForm.hidden = true;
      }

      if (commentList) {
        commentList.textContent =
          "這篇文章開啟「只想說說」，不開放留言。";
      }
    }
  }

  function renderRelatedPosts(
    posts,
    currentPostId
  ) {
    if (!relatedList) {
      return;
    }

    const relatedPosts =
      posts
        .filter(post => {
          return (
            String(post.postId) !==
            String(currentPostId)
          );
        })
        .slice(0, 8);

    if (!relatedPosts.length) {
      relatedList.innerHTML = `
        <div class="loading-message">
          目前沒有其他匿名文章。
        </div>
      `;

      return;
    }

    relatedList.innerHTML =
      relatedPosts
        .map(post => {
          const mode = String(
            post.interactionMode ||
            "討論模式"
          );

          const icon =
            modeIcons[mode] ||
            "🌸";

          return `
            <a
              class="related-item"
              href="post.html?id=${
                encodeURIComponent(
                  post.postId
                )
              }"
            >
              <strong>
                ${escapeHtml(
                  post.title ||
                  "未命名匿名文章"
                )}
              </strong>

              <small>
                ${icon}
                ${escapeHtml(mode)}
                ・
                ${escapeHtml(
                  post.category ||
                  "其他"
                )}
              </small>
            </a>
          `;
        })
        .join("");
  }

  function createEmptyCounts() {
    const counts = {};

    reactionNames.forEach(
      reaction => {
        counts[reaction] = 0;
      }
    );

    return counts;
  }

  function renderReactionButtons(
    buttons,
    counts,
    selected
  ) {
    buttons.forEach(button => {
      const reaction =
        button.dataset.reaction;

      const emoji =
        reactionEmojis[reaction] ||
        "🌸";

      const count =
        Number(
          counts?.[reaction] || 0
        );

      const isSelected =
        selected === reaction;

      button.innerHTML = `
        <span aria-hidden="true">
          ${emoji}
        </span>

        <span
          class="reaction-count"
          style="
            font-family:inherit;
            font-size:13px;
            font-weight:850;
          "
        >
          ${count}
        </span>
      `;

      button.style.display =
        "inline-flex";

      button.style.alignItems =
        "center";

      button.style.justifyContent =
        "center";

      button.style.gap =
        "7px";

      button.style.borderColor =
        isSelected
          ? "#f58ccc"
          : "";

      button.style.background =
        isSelected
          ? "rgba(245,140,204,.18)"
          : "";

      button.dataset.selected =
        isSelected
          ? "true"
          : "false";

      button.setAttribute(
        "aria-pressed",
        String(isSelected)
      );
    });
  }

  async function readReactions(
    postId,
    visitorId
  ) {
    const result =
      await loadJsonp(
        API_URL +
        "?action=getReactions" +
        "&postId=" +
        encodeURIComponent(
          postId
        ) +
        "&visitorId=" +
        encodeURIComponent(
          visitorId
        )
      );

    if (!result?.ok) {
      throw new Error(
        result?.error ||
        "Emoji 讀取失敗"
      );
    }

    return {
      selected:
        result.selected || "",

      counts:
        result.counts ||
        createEmptyCounts()
    };
  }

  async function sendReaction(
    postId,
    reaction,
    visitorId
  ) {
    const body =
      new URLSearchParams({
        action:
          "toggleReaction",

        postId,
        reaction,
        visitorId
      });

    await fetch(
      API_URL,
      {
        method: "POST",
        mode: "no-cors",
        body
      }
    );
  }

  async function connectReactionButtons(
    postId
  ) {
    const buttons = [
      ...document.querySelectorAll(
        "[data-reaction]"
      )
    ];

    if (!buttons.length) {
      return;
    }

    const actions =
      document.querySelector(
        ".post-actions"
      );

    if (actions) {
      actions.style.justifyContent =
        "flex-end";
    }

    const visitorId =
      getVisitorId();

    let selected = "";
    let counts =
      createEmptyCounts();

    renderReactionButtons(
      buttons,
      counts,
      selected
    );

    try {
      const state =
        await readReactions(
          postId,
          visitorId
        );

      selected =
        state.selected;

      counts =
        state.counts;

      renderReactionButtons(
        buttons,
        counts,
        selected
      );

    } catch (error) {
      console.error(
        "Emoji 初始資料讀取失敗：",
        error
      );
    }

    let isSending = false;

    buttons.forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          if (isSending) {
            return;
          }

          const reaction =
            button.dataset.reaction;

          if (!reaction) {
            return;
          }

          isSending = true;

          buttons.forEach(item => {
            item.disabled = true;
          });

          try {
            await sendReaction(
              postId,
              reaction,
              visitorId
            );

            await wait(900);

            const state =
              await readReactions(
                postId,
                visitorId
              );

            selected =
              state.selected;

            counts =
              state.counts;

            renderReactionButtons(
              buttons,
              counts,
              selected
            );

          } catch (error) {
            console.error(
              "Emoji 送出失敗：",
              error
            );

            window.alert(
              "Emoji 暫時無法送出，請稍後再試。"
            );

          } finally {
            isSending = false;

            buttons.forEach(item => {
              item.disabled = false;
            });
          }
        }
      );
    });
  }

  function connectShareButton(post) {
    if (!shareButton) {
      return;
    }

    shareButton.addEventListener(
      "click",
      async () => {
        const shareData = {
          title:
            `${post.title}｜ServerBloom`,

          text:
            post.content,

          url:
            window.location.href
        };

        try {
          if (navigator.share) {
            await navigator.share(
              shareData
            );

            return;
          }

          await navigator.clipboard
            .writeText(
              window.location.href
            );

          shareButton.textContent =
            "已複製連結";

        } catch (error) {
          console.error(
            "分享失敗：",
            error
          );

          window.prompt(
            "請複製文章連結：",
            window.location.href
          );
        }
      }
    );
  }

  function connectReportButton() {
    if (!reportButton) {
      return;
    }

    reportButton.addEventListener(
      "click",
      () => {
        window.alert(
          "檢舉功能尚未正式開放。"
        );
      }
    );
  }

  async function loadPostPage() {
    try {
      const [
        staticPosts,
        cloudPosts
      ] = await Promise.all([
        readStaticPosts(),
        readCloudPosts()
      ]);

      const publishedPosts =
        mergePosts(
          staticPosts,
          cloudPosts
        )
          .filter(post => {
            return (
              post.status ===
              "published"
            );
          })
          .sort(
            (postA, postB) => {
              return (
                new Date(
                  postB.publishedAt
                ).getTime() -
                new Date(
                  postA.publishedAt
                ).getTime()
              );
            }
          );

      if (
        !publishedPosts.length
      ) {
        throw new Error(
          "目前沒有公開文章"
        );
      }

      const parameters =
        new URLSearchParams(
          window.location.search
        );

      const requestedPostId =
        parameters.get("id");

      const currentPost =
        publishedPosts.find(post => {
          return (
            String(post.postId) ===
            String(requestedPostId)
          );
        }) ||
        publishedPosts[0];

      if (!requestedPostId) {
        const url =
          new URL(
            window.location.href
          );

        url.searchParams.set(
          "id",
          currentPost.postId
        );

        window.history.replaceState(
          {},
          "",
          url
        );
      }

      renderCurrentPost(
        currentPost
      );

      renderRelatedPosts(
        publishedPosts,
        currentPost.postId
      );

      connectShareButton(
        currentPost
      );

      connectReportButton();

      await connectReactionButtons(
        currentPost.postId
      );

    } catch (error) {
      console.error(
        "匿名文章全文載入失敗：",
        error
      );

      showError(
        "文章資料暫時無法讀取，請返回文章列表後再試一次。"
      );
    }
  }

  loadPostPage();
})();
