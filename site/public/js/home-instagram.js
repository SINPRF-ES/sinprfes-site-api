(function () {
  function renderFallback(feedContainer, profileUrl) {
    feedContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start;">
        <p style="margin:0;color:#666;">Siga-nos no Instagram para acompanhar as novidades.</p>
        <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="ui-button ui-button-outline" style="padding: 0.5rem 1rem; font-size: 0.875rem;">Abrir Instagram</a>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const feedContainer = document.getElementById("insta-feed");
    const profileLink = document.getElementById("insta-profile-link");
    if (!feedContainer) return;

    const defaultProfileUrl = (profileLink && profileLink.href) || "https://instagram.com/sinprfes";

    try {
      const API_BASE = (window.Utils && window.Utils.resolveApiBase)
        ? window.Utils.resolveApiBase()
        : (window.API_BASE_URL || "").replace(/\/+$/, "");

      if (!API_BASE) {
        console.error("API_BASE não definido. Verifique config.js e utils.js");
        renderFallback(feedContainer, defaultProfileUrl);
        return;
      }

      const resp = await fetch(`${API_BASE}/api/instagram`);
      const json = await resp.json();
      const fotos = json.data || [];
      const profileUrl = json.profileUrl || defaultProfileUrl;

      if (profileLink) {
        profileLink.href = profileUrl;
      }

      if (fotos.length === 0) {
        renderFallback(feedContainer, profileUrl);
        return;
      }

      feedContainer.innerHTML = fotos.map(item => {
        const imgUrl = item.imageUrl || (item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url);
        const postUrl = item.postUrl || item.permalink || profileUrl;
        const altText = item.caption || "Foto Instagram";

        return `
          <a href="${postUrl}" target="_blank" rel="noopener noreferrer" class="insta-item">
            <img src="${imgUrl}" alt="${altText}" loading="lazy">
            <div class="insta-overlay">Ver no Instagram</div>
          </a>
        `;
      }).join("");
    } catch (err) {
      console.error("Erro ao carregar Instagram", err);
      renderFallback(feedContainer, defaultProfileUrl);
    }
  });
})();
