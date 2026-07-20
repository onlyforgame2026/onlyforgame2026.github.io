(() => {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbz1xFVctSyveh82R-qMZSKwD78H9RYsoDU7l_XP3avBBiEVOOqOeM3d9D5XKkFLrlLZ/exec";

  const STATIC_POSTS_URL =
    "data/posts.json";

  const grid =
    document.querySelector(
      ".anonymous-grid"
    );

  if (!grid) {
    return;
  }

  const modeIcons = {
    "呵護模式": "🟡",
    "陪伴模式": "🌸",
    "建議模式": "💜",
    "討論模式": "🟣",
    "只想說說": "⚫"
  };

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

  function normalizeTheme(theme) {
    const allowedThemes = [
      "sakura-pink",
      "lavender",
      "pink-lavender"
    ];

    return allowedThemes.includes(theme)
      ? theme
      : "pink-lavender";
  }

  function loadJsonp(url) {
    return new Promise(
      (resolve, reject) => {
        const callbackName =
          "serverbloomList_" +
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
                "雲端文章讀取逾時"
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
              "無法連接雲端文章"
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
        "GitHub 文章讀取失敗：",
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

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "雲端文章讀取失敗"
        );
      }

      return Array.isArray(
        result.posts
      )
        ? result.posts
        : [];

    } catch (error) {
      console.error(
        "Google 雲端文章讀取失敗：",
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

  function createPostCard(post) {
    const mode = String(
      post.interactionMode ||
      "討論模式"
    );

    const icon =
      modeIcons[mode] || "🌸";

    const theme =
      normalizeTheme(
        post.theme
      );

    const postId =
      String(
        post.postId || ""
      );

    const preview =
      String(
        post.content || ""
      ).slice(0, 150);

    return `
      <a
        class="anonymous-card theme-${escapeHtml(theme)}"
        data-post-id="${escapeHtml(postId)}"
        href="post.html?id=${encodeURIComponent(postId)}"
        aria-label="閱讀文章：${escapeHtml(
          post.title ||
          "未命名匿名文章"
        )}"
      >
        <div class="card-accent"></div>

        <div class="card-content">
          <div class="card-meta">
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
          </div>

          <h3 class="card-title">
            ${escapeHtml(
              post.title ||
              "未命名匿名文章"
            )}
          </h3>

          <p class="card-preview">
            ${escapeHtml(preview)}
          </p>

          <div class="card-footer">
            <span>
              ${escapeHtml(
                post.nickname ||
                "匿名使用者"
              )}
            </span>

            <span>
              ${escapeHtml(
                formatDate(
                  post.publishedAt
                )
              )}
            </span>
          </div>
        </div>
      </a>
    `;
  }

  function highlightNewPost() {
    const parameters =
      new URLSearchParams(
        window.location.search
      );

    const publishedPostId =
      parameters.get(
        "published"
      );

    if (!publishedPostId) {
      return;
    }

    const card =
      document.querySelector(
        `[data-post-id="${CSS.escape(
          publishedPostId
        )}"]`
      );

    if (!card) {
      return;
    }

    card.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    card.style.outline =
      "3px solid #ff8fca";

    card.style.boxShadow =
      "0 0 30px rgba(255,143,202,.6)";

    window.setTimeout(() => {
      card.style.outline = "";
      card.style.boxShadow = "";
    }, 3500);

    window.history.replaceState(
      {},
      "",
      window.location.pathname
    );
  }

  async function loadPosts() {
    grid.innerHTML = `
      <div class="empty-state">
        正在載入匿名文章……
      </div>
    `;

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

      if (!publishedPosts.length) {
        grid.innerHTML = `
          <div class="empty-state">
            目前還沒有公開的匿名文章。
          </div>
        `;

        return;
      }

      grid.innerHTML =
        publishedPosts
          .map(createPostCard)
          .join("");

      highlightNewPost();

    } catch (error) {
      console.error(
        "匿名文章載入失敗：",
        error
      );

      grid.innerHTML = `
        <div class="empty-state">
          匿名文章暫時無法載入，請稍後再試。
        </div>
      `;
    }
  }

  loadPosts();
})();
