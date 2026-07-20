(() => {
  "use strict";

  const DATA_URL = "../data/people.json";

  const grid = document.querySelector("#peopleGrid");
  const status = document.querySelector("#peopleStatus");

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[char]
    );
  }

  function safeUrl(value) {
    const url = String(value || "").trim();

    if (!url) {
      return "";
    }

    try {
      const parsed = new URL(url);

      if (parsed.protocol !== "https:") {
        return "";
      }

      return parsed.href;
    } catch {
      return "";
    }
  }

  function initials(name) {
    const text = String(name || "SB").trim();

    return (
      text
        .split(/\s+/)
        .map(word => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "SB"
    );
  }

  function renderAvatar(person) {
    const avatar = safeUrl(person.avatar);
    const nickname = escapeHtml(person.nickname || "未命名");

    if (avatar) {
      return `
        <div class="person-avatar">
          <img
            class="person-avatar-image"
            src="${escapeHtml(avatar)}"
            alt="${nickname} 的頭像"
            loading="lazy"
          >
        </div>
      `;
    }

    return `
      <div class="person-avatar person-avatar-fallback">
        ${escapeHtml(initials(person.nickname))}
      </div>
    `;
  }

  function renderBanner(person) {
    const banner = safeUrl(person.banner);

    if (banner) {
      return `
        <div class="person-banner">
          <img
            class="person-banner-image"
            src="${escapeHtml(banner)}"
            alt="${escapeHtml(person.nickname || "使用者")} 的 Banner"
            loading="lazy"
          >
        </div>
      `;
    }

    return `<div class="person-banner person-banner-fallback"></div>`;
  }

  function renderLinks(person) {
    const links = [];

    const discordUrl = safeUrl(person.discordUrl);
    const github = safeUrl(person.github);
    const website = safeUrl(person.website);

    if (discordUrl) {
      links.push(`
        <a
          class="person-action primary"
          href="${escapeHtml(discordUrl)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Discord 聯絡
        </a>
      `);
    }

    if (github) {
      links.push(`
        <a
          class="person-action"
          href="${escapeHtml(github)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      `);
    }

    if (website) {
      links.push(`
        <a
          class="person-action"
          href="${escapeHtml(website)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          網站
        </a>
      `);
    }

    if (!links.length) {
      return "";
    }

    return `
      <div class="person-actions">
        ${links.join("")}
      </div>
    `;
  }

  function renderPerson(person) {
    const nickname = escapeHtml(person.nickname || "未命名");
    const username = escapeHtml(person.username || "");
    const role = escapeHtml(person.role || "");
    const bio = escapeHtml(person.bio || "");
    const gender = escapeHtml(person.gender || "");
    const tags = Array.isArray(person.tags) ? person.tags : [];
    const promotionTypes = Array.isArray(person.promotionTypes)
      ? person.promotionTypes
      : [];

    return `
      <article class="person-card" data-person-id="${escapeHtml(person.id || "")}">
        ${renderBanner(person)}

        <div class="person-card-body">
          ${renderAvatar(person)}

          <div class="person-name-row">
            <h2>${nickname}</h2>
            ${gender ? `<span class="person-gender">${gender}</span>` : ""}
          </div>

          ${username ? `<p class="person-username">@${username}</p>` : ""}
          ${role ? `<p class="person-role">${role}</p>` : ""}
          ${bio ? `<p class="person-bio">${bio}</p>` : ""}

          ${
            promotionTypes.length
              ? `
                <div class="person-promotions">
                  ${promotionTypes
                    .map(
                      item =>
                        `<span>${escapeHtml(item)}</span>`
                    )
                    .join("")}
                </div>
              `
              : ""
          }

          ${
            tags.length
              ? `
                <div class="person-tags">
                  ${tags
                    .map(
                      tag =>
                        `<span>#${escapeHtml(tag)}</span>`
                    )
                    .join("")}
                </div>
              `
              : ""
          }

          ${renderLinks(person)}
        </div>
      </article>
    `;
  }

  async function loadPeople() {
    try {
      status.textContent = "正在載入個人資料…";

      const response = await fetch(DATA_URL, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const people = await response.json();

      if (!Array.isArray(people)) {
        throw new Error("people.json 格式錯誤");
      }

      grid.innerHTML = people.map(renderPerson).join("");

      status.textContent = `顯示 ${people.length} 位使用者`;
    } catch (error) {
      console.error(error);

      status.textContent = "個人資料載入失敗";

      grid.innerHTML = `
        <div class="people-error">
          無法讀取 people.json，請稍後再試。
        </div>
      `;
    }
  }

  loadPeople();
})();
