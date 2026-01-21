const $ = (sel) => document.querySelector(sel);

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseDate(d) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}
function formatDate(d) {
  const dt = parseDate(d);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function safeUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function youtubeEmbed(url) {
  const u = new URL(url);
  let id = "";
  if (u.hostname === "youtu.be") id = u.pathname.replace("/", "");
  if (!id && u.hostname.includes("youtube.com")) id = u.searchParams.get("v") || "";
  if (!id) return null;
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
}

function vimeoEmbed(url) {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);
  const id = parts[0] || "";
  if (!/^\d+$/.test(id)) return null;
  return `https://player.vimeo.com/video/${id}`;
}

function renderBlock(block) {
  const t = block?.type;

  if (t === "h2") return `<h2>${escapeHtml(block.text)}</h2>`;
  if (t === "p") return `<p>${escapeHtml(block.text)}</p>`;

  if (t === "list") {
    const items = (block.items || []).map(i => `<li>${escapeHtml(i)}</li>`).join("");
    return `<ul>${items}</ul>`;
  }

  if (t === "quote") {
    const by = block.by ? `<div class="quote-by">— ${escapeHtml(block.by)}</div>` : "";
    return `<blockquote class="quote"><div>${escapeHtml(block.text)}</div>${by}</blockquote>`;
  }

  if (t === "callout") {
    const kind = escapeHtml(block.kind || "note");
    const title = block.title ? `<div class="callout-title">${escapeHtml(block.title)}</div>` : "";
    const text = block.text ? `<div class="callout-text">${escapeHtml(block.text)}</div>` : "";
    return `<div class="callout callout-${kind}">${title}${text}</div>`;
  }

  if (t === "image") {
    const src = safeUrl(block.url);
    if (!src) return "";
    const cap = block.caption ? `<div class="img-cap">${escapeHtml(block.caption)}</div>` : "";
    const alt = escapeHtml(block.alt || "");
    return `<figure class="img"><img src="${src}" alt="${alt}" loading="lazy" />${cap}</figure>`;
  }

  if (t === "sources") {
    const items = (block.items || []).map(s => {
      const href = safeUrl(s.url);
      if (!href) return "";
      const label = escapeHtml(s.label || href);
      return `<li><a href="${href}" target="_blank" rel="noopener">${label}</a></li>`;
    }).join("");
    return `<div class="sources"><h3>Sources</h3><ul>${items}</ul></div>`;
  }

  if (t === "video") {
    const url = safeUrl(block.url);
    if (!url) return "";
    const provider = block.provider || "youtube";

    let embed = null;
    if (provider === "youtube") embed = youtubeEmbed(url);
    if (provider === "vimeo") embed = vimeoEmbed(url);

    const title = block.title ? `<div class="vid-title">${escapeHtml(block.title)}</div>` : "";
    const caption = block.caption ? `<div class="vid-cap">${escapeHtml(block.caption)}</div>` : "";

    // fallback if we can't embed (ex: rumble, odysee) – still shows a clean watch button
    if (!embed) {
      return `
        <div class="video-wrap">
          ${title}
          <div class="video-card">
            <a class="button secondary" href="${url}" target="_blank" rel="noopener">Watch video</a>
          </div>
          ${caption}
        </div>
      `;
    }

    return `
      <div class="video-wrap">
        ${title}
        <div class="video">
          <iframe
            src="${embed}"
            title="${escapeHtml(block.title || "Video")}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen></iframe>
        </div>
        ${caption}
      </div>
    `;
  }

  return "";
}

function renderBlocks(blocks) {
  return (blocks || []).map(renderBlock).join("\n");
}

function getSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

async function init() {
  $("#year").textContent = new Date().getFullYear();

  const slug = getSlug();
  if (!slug) {
    $("#article").innerHTML = `<p class="muted">Missing article slug.</p>`;
    return;
  }

  const res = await fetch("./posts.json", { cache: "no-store" });
  const posts = await res.json();

  const post = posts.find(p => p.slug === slug);
  if (!post) {
    $("#article").innerHTML = `<p class="muted">Article not found.</p>`;
    return;
  }

  document.title = `${post.title} • My Blog`;

  const tags = (post.tags || []).map(t => `<span class="badge accent">#${escapeHtml(t)}</span>`).join(" ");

  $("#article").innerHTML = `
    <div class="post-meta">
      <span class="badge">${formatDate(post.date)}</span>
      ${tags}
    </div>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="muted">${escapeHtml(post.excerpt || "")}</p>
    <div class="content">${renderBlocks(post.blocks)}</div>
  `;

  const url = window.location.href;

  $("#copyLink").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      $("#copyLink").textContent = "Copied!";
      setTimeout(() => ($("#copyLink").textContent = "Copy link"), 1200);
    } catch {
      alert("Could not copy link.");
    }
  });

  const tweetText = encodeURIComponent(post.title);
  const tweetUrl = encodeURIComponent(url);
  $("#tweetLink").href = `https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`;
}

init().catch(err => {
  console.error(err);
  $("#article").innerHTML = `<p class="muted">Error loading article.</p>`;
});
