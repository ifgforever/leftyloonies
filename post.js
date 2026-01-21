const $ = (sel) => document.querySelector(sel);

function parseDate(d) {
  const [y,m,day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}
function formatDate(d) {
  const dt = parseDate(d);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// minimal markdown-ish renderer (headings + lists + paragraphs)
function renderContent(lines) {
  const out = [];
  let inList = false;

  for (const raw of (lines || [])) {
    const line = (raw ?? "").toString();

    if (line.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }

    if (inList) { out.push("</ul>"); inList = false; }

    if (line.trim().length === 0) continue;
    out.push(`<p>${escapeHtml(line)}</p>`);
  }

  if (inList) out.push("</ul>");
  return out.join("\n");
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

  const tags = (post.tags || []).map(t => `<span class="badge accent">#${t}</span>`).join(" ");
  const url = window.location.href;

  $("#article").innerHTML = `
    <div class="post-meta">
      <span class="badge">${formatDate(post.date)}</span>
      ${tags}
    </div>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="muted">${escapeHtml(post.excerpt || "")}</p>
    <div class="content">${renderContent(post.content)}</div>
  `;

  $("#copyLink").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      $("#copyLink").textContent = "Copied!";
      setTimeout(() => $("#copyLink").textContent = "Copy link", 1200);
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
