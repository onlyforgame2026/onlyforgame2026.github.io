(() => {
  "use strict";

  const grid = document.querySelector(".anonymous-grid");

  if (!grid) {
    return;
  }

  onst modeIcons = {
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

    if (Number.isNaN(date.getTime())) {
      return "時間未公開";
    }

    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
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

  function createPostCard(post) {
    const mode = String(
      post.interactionMode || "討論模式"
    );

    const icon = modeIcons[mode] || "🌸";
    const theme = normalizeTheme(post.theme);

    return `
      <article
        class="anonymous-card theme-${escapeHtml(theme)}"
        data-post-id="${escapeHtml(post.postId)}"
      >
        <div class="card-accent"></div>

        <div class="card-content">
          <div class="card-meta">
            <span class="card-label">
              ${icon} ${escapeHtml(mode)}
            </span>

            <span class="card-label">
              ${escapeHtml(post.category || "其他")}
            </span>
          </div>

          <h3 class="card-title">
            ${escapeHtml(post.title || "未命名匿名文章")}
          </h3>

          <p class="card-preview">
            ${escapeHtml(post.content || "")}
          </p>

          <div class="card-footer">
            <span>
              ${escapeHtml(post.nickname || "匿名使用者")}
            </span>

            <span>
              ${escapeHtml(formatDate(post.publishedAt))}
            </span>
          </div>
        </div>
      </article>
    `;
  }

  async function loadPosts() {
    grid.innerHTML = `
      <div class="empty-state">
        正在載入匿名文章……
      </div>
    `;

    try {
      const response = await fetch(
        "data/posts.json",
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(
          `無法讀取文章資料：${response.status}`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("文章資料格式不正確");
      }

      const publishedPosts = data
        .filter(post => post.status === "published")
        .sort((postA, postB) => {
          return (
            new Date(postB.publishedAt).getTime() -
            new Date(postA.publishedAt).getTime()
          );
        });

      if (!publishedPosts.length) {
        grid.innerHTML = `
          <div class="empty-state">
            目前還沒有公開的匿名文章。
          </div>
        `;
        return;
      }

      grid.innerHTML = publishedPosts
        .map(createPostCard)
        .join("");

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
