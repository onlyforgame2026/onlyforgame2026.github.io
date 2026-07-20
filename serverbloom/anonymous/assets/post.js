(() => {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbz1xFVctSyveh82R-qMZSKwD78H9RYsoDU7l_XP3avBBiEVOOqOeM3d9D5XKkFLrlLZ/exec";
  const STATIC_POSTS_URL = "data/posts.json";

  const postMeta = document.querySelector("#postMeta");
  const postTitle = document.querySelector("#postTitle");
  const postAuthor = document.querySelector("#postAuthor");
  const postContent = document.querySelector("#postContent");
  const relatedList = document.querySelector("#relatedList");
  const shareButton = document.querySelector("#shareButton");
  const reportButton = document.querySelector("#reportButton");
  const commentForm = document.querySelector("#commentForm");
  const commentNickname = document.querySelector("#commentNickname");
  const commentContent = document.querySelector("#commentContent");
  const commentButton = document.querySelector("#commentButton");
  const commentList = document.querySelector("#commentList");

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

  const textColors = {
    "sakura-pink": "#f8b4d8",
    lavender: "#d8c2ff",
    "pink-lavender": "#f4ecdf"
  };

  const reactionNames = Object.keys(reactionEmojis);
  let currentComments = [];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "時間未公開";

    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function wait(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }

  function getVisitorId() {
    const key = "serverbloomAnonymousVisitorId";
    let visitorId = localStorage.getItem(key);

    if (!visitorId) {
      visitorId = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(key, visitorId);
    }

    return visitorId;
  }

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `serverbloomJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("雲端資料讀取逾時"));
      }, 12000);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = data => {
        cleanup();
        resolve(data);
      };

      const separator = url.includes("?") ? "&" : "?";
      script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}`;
      script.onerror = () => {
        cleanup();
        reject(new Error("無法連接雲端資料庫"));
      };

      document.body.appendChild(script);
    });
  }

  async function sendForm(data) {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      body: new URLSearchParams(data)
    });
  }

  async function readStaticPosts() {
    try {
      const response = await fetch(STATIC_POSTS_URL, { cache: "no-store" });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("本地文章讀取失敗：", error);
      return [];
    }
  }

  async function readCloudPosts() {
    try {
      const result = await loadJsonp(`${API_URL}?action=listPosts&limit=200`);
      return Array.isArray(result?.posts) ? result.posts : [];
    } catch (error) {
      console.error("雲端文章讀取失敗：", error);
      return [];
    }
  }

  function mergePosts(staticPosts, cloudPosts) {
    const map = new Map();
    [...staticPosts, ...cloudPosts].forEach(post => {
      if (post?.postId) map.set(String(post.postId), post);
    });
    return [...map.values()];
  }

  function showError(message) {
    if (postMeta) postMeta.innerHTML = '<span class="card-label">載入失敗</span>';
    if (postTitle) postTitle.textContent = "找不到這篇匿名文章";
    if (postAuthor) postAuthor.textContent = "";
    if (postContent) postContent.textContent = message;
    if (relatedList) relatedList.innerHTML = '<div class="loading-message">暫時無法載入其他文章。</div>';
  }

  function renderCurrentPost(post) {
    const mode = String(post.interactionMode || "討論模式");
    const icon = modeIcons[mode] || "🌸";

    postMeta.innerHTML = `
      <span class="card-label">${icon} ${escapeHtml(mode)}</span>
      <span class="card-label">${escapeHtml(post.category || "其他")}</span>
    `;

    postTitle.textContent = post.title || "未命名匿名文章";
    postAuthor.textContent = `${post.nickname || "匿名使用者"}・${formatDate(post.publishedAt)}`;
    postContent.textContent = post.content || "這篇文章沒有內容。";
    postContent.style.color = textColors[post.theme] || textColors["pink-lavender"];
    document.title = `${post.title || "匿名文章"}｜ServerBloom`;
    document.body.dataset.theme = post.theme || "pink-lavender";

    if (commentForm) commentForm.hidden = false;
    if (commentButton) {
      commentButton.disabled = false;
      commentButton.textContent = "送出匿名留言";
    }
  }

  function renderRelatedPosts(posts, currentPostId) {
    if (!relatedList) return;

    const relatedPosts = posts
      .filter(post => String(post.postId) !== String(currentPostId))
      .slice(0, 8);

    if (!relatedPosts.length) {
      relatedList.innerHTML = '<div class="loading-message">目前沒有其他匿名文章。</div>';
      return;
    }

    relatedList.innerHTML = relatedPosts.map(post => {
      const mode = String(post.interactionMode || "討論模式");
      const icon = modeIcons[mode] || "🌸";
      return `
        <a class="related-item" href="post.html?id=${encodeURIComponent(post.postId)}">
          <strong>${escapeHtml(post.title || "未命名匿名文章")}</strong>
          <small>${icon} ${escapeHtml(mode)}・${escapeHtml(post.category || "其他")}</small>
        </a>
      `;
    }).join("");
  }

  function createEmptyCounts() {
    return Object.fromEntries(reactionNames.map(name => [name, 0]));
  }

  function renderReactionButtons(buttons, counts, selected) {
    buttons.forEach(button => {
      const reaction = button.dataset.reaction;
      const emoji = reactionEmojis[reaction] || "🌸";
      const count = Number(counts?.[reaction] || 0);
      const isSelected = selected === reaction;

      button.innerHTML = `
        <span aria-hidden="true">${emoji}</span>
        <span class="reaction-count" style="font-family:inherit;font-size:13px;font-weight:850">${count}</span>
      `;
      button.style.display = "inline-flex";
      button.style.alignItems = "center";
      button.style.justifyContent = "center";
      button.style.gap = "7px";
      button.style.borderColor = isSelected ? "#f58ccc" : "";
      button.style.background = isSelected ? "rgba(245,140,204,.18)" : "";
      button.style.transform = isSelected ? "translateY(-2px) scale(1.04)" : "";
      button.dataset.selected = isSelected ? "true" : "false";
      button.setAttribute("aria-pressed", String(isSelected));
    });
  }

  async function readReactions(postId, visitorId) {
    const result = await loadJsonp(
      `${API_URL}?action=getReactions&postId=${encodeURIComponent(postId)}&visitorId=${encodeURIComponent(visitorId)}`
    );

    if (!result?.ok) throw new Error(result?.error || "Emoji 讀取失敗");

    return {
      selected: result.selected || "",
      counts: result.counts || createEmptyCounts()
    };
  }

  function applyOptimisticReaction(state, reaction) {
    const next = {
      selected: state.selected,
      counts: { ...state.counts }
    };

    if (next.selected === reaction) {
      next.counts[reaction] = Math.max(0, Number(next.counts[reaction] || 0) - 1);
      next.selected = "";
      return next;
    }

    if (next.selected) {
      next.counts[next.selected] = Math.max(0, Number(next.counts[next.selected] || 0) - 1);
    }

    next.counts[reaction] = Number(next.counts[reaction] || 0) + 1;
    next.selected = reaction;
    return next;
  }

  async function connectReactionButtons(postId) {
    const buttons = [...document.querySelectorAll("[data-reaction]")];
    if (!buttons.length) return;

    const actions = document.querySelector(".post-actions");
    if (actions) actions.style.justifyContent = "flex-end";

    const visitorId = getVisitorId();
    let state = { selected: "", counts: createEmptyCounts() };
    let syncing = false;

    renderReactionButtons(buttons, state.counts, state.selected);

    try {
      state = await readReactions(postId, visitorId);
      renderReactionButtons(buttons, state.counts, state.selected);
    } catch (error) {
      console.error("Emoji 初始資料讀取失敗：", error);
    }

    buttons.forEach(button => {
      button.addEventListener("click", async () => {
        if (syncing) return;
        const reaction = button.dataset.reaction;
        if (!reaction) return;

        const previous = {
          selected: state.selected,
          counts: { ...state.counts }
        };

        state = applyOptimisticReaction(state, reaction);
        renderReactionButtons(buttons, state.counts, state.selected);
        syncing = true;

        try {
          await sendForm({
            action: "toggleReaction",
            postId,
            reaction,
            visitorId
          });

          await wait(350);
          state = await readReactions(postId, visitorId);
          renderReactionButtons(buttons, state.counts, state.selected);
        } catch (error) {
          console.error("Emoji 送出失敗：", error);
          state = previous;
          renderReactionButtons(buttons, state.counts, state.selected);
          window.alert("Emoji 暫時無法送出，請稍後再試。");
        } finally {
          yncing = false;
        }
      });
    });
  }

  function renderComments(comments) {
    if (!commentList) return;
    currentComments = [...comments].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (!currentComments.length) {
      commentList.innerHTML = "目前還沒有公開留言。";
      return;
    }

    commentList.innerHTML = currentComments.map(comment => `
      <article style="padding:18px;margin-bottom:14px;border:1px solid rgba(198,160,255,.22);border-radius:15px;background:rgba(7,6,20,.52)">
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;color:#cdbfe0;font-size:14px">
          <strong style="color:#f3e9ff">${escapeHtml(comment.nickname || "匿名使用者")}</strong>
          <span>${escapeHtml(formatDate(comment.createdAt))}</span>
        </div>
        <div style="color:#f0e9f8;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(comment.content || "")}</div>
      </article>
    `).join("");
  }

  async function loadComments(postId) {
    try {
      const result = await loadJsonp(
        `${API_URL}?action=listComments&postId=${encodeURIComponent(postId)}`
      );
      if (!result?.ok) throw new Error(result?.error || "留言讀取失敗");
      renderComments(Array.isArray(result.comments) ? result.comments : []);
    } catch (error) {
      console.error("留言讀取失敗：", error);
      if (commentList) commentList.textContent = "留言暫時無法載入，請稍後再試。";
    }
  }

  function connectCommentForm(postId) {
    if (!commentButton || !commentContent) return;

    commentButton.textContent = "送出匿名留言";
    commentButton.disabled = false;

    commentButton.addEventListener("click", async () => {
      const content = commentContent.value.trim();
      const nickname = commentNickname?.value.trim() || "匿名使用者";

      if (!content) {
        window.alert("請先輸入留言內容。");
        commentContent.focus();
        return;
      }

      const previousComments = [...currentComments];
      const optimisticComment = {
        commentId: `temporary-${Date.now()}`,
        postId,
        nickname,
        content,
        createdAt: new Date().toISOString(),
        status: "published"
      };

      renderComments([optimisticComment, ...currentComments]);
      commentContent.value = "";
      commentButton.disabled = true;
      commentButton.textContent = "正在送出留言……";

      try {
        await sendForm({
          action: "createComment",
          postId,
          nickname,
          content,
          visitorId: getVisitorId()
        });

        await wait(350);
        await loadComments(postId);
        commentButton.textContent = "留言已送出 ✓";
        window.setTimeout(() => {
          commentButton.textContent = "送出匿名留言";
        }, 1200);
      } catch (error) {
        console.error("留言送出失敗：", error);
        renderComments(previousComments);
        commentContent.value = content;
        window.alert("留言暫時無法送出，請稍後再試。");
        commentButton.textContent = "重新送出留言";
      } finally {
        commentButton.disabled = false;
      }
    });
  }

  function connectShareButton(post) {
    if (!shareButton) return;

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

        await navigator.clipboard.writeText(window.location.href);
        shareButton.textContent = "已複製連結";
      } catch (error) {
        window.prompt("請複製文章連結：", window.location.href);
      }
    });
  }

  function connectReportButton() {
    if (!reportButton) return;
    reportButton.addEventListener("click", () => {
      window.alert("檢舉功能尚未正式開放。");
    });
  }

  async function loadPostPage() {
    try {
      const [staticPosts, cloudPosts] = await Promise.all([
        readStaticPosts(),
        readCloudPosts()
      ]);

      const publishedPosts = mergePosts(staticPosts, cloudPosts)
        .filter(post => post.status === "published")
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      if (!publishedPosts.length) throw new Error("目前沒有公開文章");

      const parameters = new URLSearchParams(window.location.search);
      const requestedPostId = parameters.get("id");
      const currentPost = publishedPosts.find(post =>
        String(post.postId) === String(requestedPostId)
      ) || publishedPosts[0];

      if (!requestedPostId) {
        const url = new URL(window.location.href);
        url.searchParams.set("id", currentPost.postId);
        window.history.replaceState({}, "", url);
      }

      renderCurrentPost(currentPost);
      renderRelatedPosts(publishedPosts, currentPost.postId);
      connectShareButton(currentPost);
      connectReportButton();
      connectCommentForm(currentPost.postId);

      await Promise.all([
        connectReactionButtons(currentPost.postId),
        loadComments(currentPost.postId)
      ]);
    } catch (error) {
      console.error("匿名文章全文載入失敗：", error);
      showError("文章資料暫時無法讀取，請返回文章列表後再試一次。");
    }
  }

  loadPostPage();
})();
