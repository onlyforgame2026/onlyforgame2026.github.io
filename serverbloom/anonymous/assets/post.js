(() => {
  "use strict";

  const postMeta = document.querySelector("#postMeta");
  const postTitle = document.querySelector("#postTitle");
  const postAuthor = document.querySelector("#postAuthor");
  const postContent = document.querySelector("#postContent");
  const relatedList = document.querySelector("#relatedList");
  const shareButton = document.querySelector("#shareButton");
  const reportButton = document.querySelector("#reportButton");
  const commentForm = document.querySelector("#commentForm");
  const commentList = document.querySelector("#commentList");

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

  function showError(message) {
    postMeta.innerHTML = `
      <span class="card-label">載入失敗</span>
    `;

    postTitle.textContent = "找不到這篇匿名文章";
    postAuthor.textContent = "";
    postContent.textContent = message;

    relatedList.innerHTML = `
      <div class="loading-message">
        暫時無法載入其他文章。
      </div>
    `;
  }

  function renderCurrentPost(post) {
    const mode = String(
      post.interactionMode || "討論模式"
    );

    const icon = modeIcons[mode] || "🌸";

    postMeta.innerHTML = `
      <span class="card-label">
        ${icon} ${escapeHtml(mode)}
      </span>

      <span class="card-label">
        ${escapeHtml(post.category || "其他")}
      </span>
    `;

    postTitle.textContent =
      post.title || "未命名匿名文章";

    postAuthor.textContent = `${
      post.nickname || "匿名使用者"
    }・${formatDate(post.publishedAt)}`;

    postContent.textContent =
      post.content || "這篇文章沒有內容。";

    document.title =
      `${post.title || "匿名文章"}｜ServerBloom`;

    document.body.dataset.theme =
      post.theme || "pink-lavender";

    if (mode === "只想說說") {
      if (commentForm) {
        commentForm.hidden = true;
      }

      if (commentList) {
        commentList.textContent =
          "這篇文章開啟「只想說說」，不開放留言。";
      }
    }
  }

  function renderRelatedPosts(posts, currentPostId) {
    const relatedPosts = posts
      .filter(post => post.postId !== currentPostId)
      .slice(0, 8);

    if (!relatedPosts.length) {
      relatedList.innerHTML = `
        <div class="loading-message">
          目前沒有其他匿名文章。
        </div>
      `;
      return;
    }

    relatedList.innerHTML = relatedPosts
      .map(post => {
        const mode = String(
          post.interactionMode || "討論模式"
        );

        const icon = modeIcons[mode] || "🌸";

        return `
          <a
            class="related-item"
            href="post.html?id=${encodeURIComponent(post.postId)}"
          >
            <strong>
              ${escapeHtml(post.title || "未命名匿名文章")}
            </strong>

            <small>
              ${icon}
              ${escapeHtml(mode)}
              ・
              ${escapeHtml(post.category || "其他")}
            </small>
          </a>
        `;
      })
      .join("");
  }

  function connectShareButton(post) {
    if (!shareButton) {
      return;
    }

    shareButton.addEventListener("click", async () => {
      const shareData = {
        title: `${post.title}｜ServerBloom`,
        text: post.content,
        url: window.location.href
      };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
          return;
        }

        await navigator.clipboard.writeText(
          window.location.href
        );

        shareButton.textContent = "已複製連結";
      } catch (error) {
        console.error("分享失敗：", error);

        window.prompt(
          "請複製文章連結：",
          window.location.href
        );
      }
    });
  }

  function connectReportButton() {
    if (!reportButton) {
      return;
    }

    reportButton.addEventListener("click", () => {
      window.alert(
        "檢舉功能尚未正式開放。"
      );
    });
  }

  function connectReactionButtons() {
    document
      .querySelectorAll("[data-reaction]")
      .forEach(button => {
        button.addEventListener("click", () => {
          document
            .querySelectorAll("[data-reaction]")
            .forEach(item => {
              item.removeAttribute("data-selected");
              item.style.borderColor = "";
              item.style.background = "";
            });

          button.dataset.selected = "true";
          button.style.borderColor = "var(--sakura)";
          button.style.background =
            "rgba(255, 143, 202, 0.15)";
        });
      });
  }

  async function loadPostPage() {
    try {
      const response = await fetch(
        "data/posts.json",
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(
          `文章資料讀取失敗：${response.status}`
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
        throw new Error("目前沒有公開文章");
      }

      const parameters =
        new URLSearchParams(window.location.search);

      const requestedPostId =
        parameters.get("id");

      const currentPost =
        publishedPosts.find(post => {
          return post.postId === requestedPostId;
        }) || publishedPosts[0];

      if (!requestedPostId) {
        const url = new URL(window.location.href);

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

      renderCurrentPost(currentPost);

      renderRelatedPosts(
        publishedPosts,
        currentPost.postId
      );

      connectShareButton(currentPost);
      connectReportButton();
      connectReactionButtons();

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
