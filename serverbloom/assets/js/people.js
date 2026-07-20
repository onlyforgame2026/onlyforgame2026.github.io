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

  function renderPerson(person) {
    const nickname = escapeHtml(person.nickname || "未命名");
    const username = escapeHtml(person.username || "");
    const role = escapeHtml(person.role || "");
    const bio = escapeHtml(person.bio || "");
    const tags = Array.isArray(person.tags) ? person.tags : [];

    return `
      <article class="person-card">
        <div class="person-banner"></div>

        <div class="person-card-body">
          <div class="person-avatar">
            ${nickname.slice(0, 1).toUpperCase()}
          </div>

          <h2>${nickname}</h2>
          <p class="person-username">@${username}</p>
          <p class="person-role">${role}</p>
          <p class="person-bio">${bio}</p>

          <div class="person-tags">
            ${tags
              .map(tag => `<span>${escapeHtml(tag)}</span>`)
              .join("")}
          </div>
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
