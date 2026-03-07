(function () {
  const PROFILE_URL = "https://instagram.com/sinprfes";
  const AUTOPLAY_DELAY = 5000;
  const SCROLL_STEP = 232;

  function trackInstagramClick(meta) {
    console.log("instagram_click", meta);
    window.dispatchEvent(new CustomEvent("instagram_click", { detail: meta }));
  }

  function renderSkeleton(container) {
    container.innerHTML = `
      <div class="instagram-carousel skeleton">
        <div class="insta-card-skeleton"></div>
        <div class="insta-card-skeleton"></div>
        <div class="insta-card-skeleton"></div>
        <div class="insta-card-skeleton"></div>
        <div class="insta-card-skeleton"></div>
      </div>
    `;
  }

  function renderFallback(container) {
    container.innerHTML = `
      <div class="instagram-fallback">
        <p>Acompanhe nossas publicações no Instagram.</p>
        <a class="btn-instagram" href="${PROFILE_URL}" target="_blank" rel="noopener noreferrer" data-instagram-click="fallback">
          Ver no Instagram
        </a>
      </div>
    `;
    enableAnalytics();
  }

  function enableCarousel(wrapper) {
    let scroll = 0;

    setInterval(() => {
      const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
      scroll += SCROLL_STEP;

      if (scroll > maxScroll) {
        scroll = 0;
      }

      wrapper.scrollTo({
        left: scroll,
        behavior: "smooth",
      });
    }, AUTOPLAY_DELAY);
  }

  function enableAnalytics() {
    document.querySelectorAll("[data-instagram-click]").forEach((el) => {
      if (el.dataset.instagramTracked === "true") return;
      el.dataset.instagramTracked = "true";

      el.addEventListener("click", () => {
        trackInstagramClick({
          href: el.href,
          source: el.dataset.instagramClick || "post",
        });
      });
    });
  }

  function renderFeed(container, posts) {
    const wrapper = document.createElement("div");
    wrapper.className = "instagram-carousel";

    posts.forEach((post, index) => {
      const card = document.createElement("div");
      card.className = "instagram-card";
      const rawTitle = (post.title || "").trim();
      const safeTitle = (rawTitle || "Post no Instagram").replace(/"/g, "&quot;");
      const cardCaption = rawTitle || "Sem legenda disponível.";

      card.innerHTML = `
        <a href="${post.link}" target="_blank" rel="noopener noreferrer" data-instagram-click="post_${index + 1}" aria-label="${safeTitle}">
          <div class="instagram-image-wrapper">
            <img src="${post.image}" alt="${safeTitle}" loading="lazy">
          </div>
          <p class="instagram-card-caption">${cardCaption}</p>
        </a>
      `;
      wrapper.appendChild(card);
    });

    container.innerHTML = "";
    container.appendChild(wrapper);

    if (posts.length > 1) {
      enableCarousel(wrapper);
    }
    enableAnalytics();
  }

  async function carregarInstagramFeed() {
    const container = document.querySelector("#instagram-feed");
    if (!container) return;

    renderSkeleton(container);

    try {
      const API_BASE = window.Utils?.resolveApiBase
        ? window.Utils.resolveApiBase()
        : (window.API_BASE_URL || "").replace(/\/+$/, "");

      const res = await fetch(`${API_BASE}/api/public/instagram-feed`);
      const data = await res.json();

      if (!data.ok || !Array.isArray(data.posts) || data.posts.length === 0) {
        throw new Error("instagram_feed_empty");
      }

      renderFeed(container, data.posts);
    } catch (err) {
      renderFallback(container);
    }
  }

  document.addEventListener("DOMContentLoaded", carregarInstagramFeed);
})();
