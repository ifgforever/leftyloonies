const $ = (sel) => document.querySelector(sel);

function parseDate(d) {
  // d is YYYY-MM-DD
  const [y,m,day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function formatDate(d) {
  const dt = parseDate(d);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function normalize(str) {
  return (str || "").toLowerCase().trim();
}

function uniqueTags(posts) {
  const set = new Set();
  posts.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return [...set].sort((a,b) => a.localeCompare(b));
}

function buildTagSelect(tags) {
  const select = $("#tagSelect");
  tags.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
}

function buildTagChips(tags) {
  const chips = $("#tagChips");
  chips.innerHTML = "";
  tags.forEach(t => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = t;
    chip.dataset.tag = t;
    chips.appendChild(chip);
  });
}

function renderPosts(posts) {
  const container = $("#posts");
  container.innerHTML = "";

  if (!posts.length) {
    container.innerHTML = `<div class="card"><p class="muted">No matching articles.</p></div>`;
    return;
  }

  posts.forEach(p => {
    const el = document.createElement("div");
    el.className = "card post-card";

    const tags = (p.tags || [])
      .map(t => `<span class="badge accent">#${t}</span>`)
      .join(" ");

    el.innerHTML = `
      <div class="post-meta">
        <span class="badge">${formatDate(p.date)}</span>
        ${tags}
      </div>
      <h3><a href="./post.html?slug=${encodeURIComponent(p.slug)}">${p.title}</a></h3>
      <p class="excerpt">${p.excerpt || ""}</p>
      <div style="margin-top:12px;">
        <a class="button secondary" href="./post.html?slug=${encodeURIComponent(p.slug)}">Read</a>
      </div>
    `;
    container.appendChild(el);
  });
}

function applyFilters(allPosts) {
  const q = normalize($("#searchInput").value);
  const selectedTag = $("#tagSelect").value;
  const sort = $("#sortSelect").value;

  // chip tag (optional)
  const activeChip = document.querySelector(".chip.active");
  const chipTag = activeChip ? activeChip.dataset.tag : "";

  let filtered = allPosts.filter(p => {
    const hay = normalize([p.title, p.excerpt, (p.tags||[]).join(" "), (p.content||[]).join(" ")].join(" "));
    const matchesQuery = !q || hay.includes(q);
    const matchesSelect = !selectedTag || (p.tags || []).includes(selectedTag);
    const matchesChip = !chipTag || (p.tags || []).includes(chipTag);
    return matchesQuery && matchesSelect && matchesChip;
  });

  filtered.sort((a,b) => {
    const da = parseDate(a.date).getTime();
    const db = parseDate(b.date).getTime();
    return sort === "old" ? (da - db) : (db - da);
  });

  renderPosts(filtered);
}

async function init() {
  $("#year").textContent = new Date().getFullYear();

  const res = await fetch("./posts.json", { cache: "no-store" });
  const posts = await res.json();

  const tags = uniqueTags(posts);
  buildTagSelect(tags);
  buildTagChips(tags);

  // listeners
  $("#searchInput").addEventListener("input", () => applyFilters(posts));
  $("#tagSelect").addEventListener("change", () => applyFilters(posts));
  $("#sortSelect").addEventListener("change", () => applyFilters(posts));

  $("#tagChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const already = chip.classList.contains("active");
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    if (!already) chip.classList.add("active");
    applyFilters(posts);
  });

  applyFilters(posts);
}

init().catch(err => {
  console.error(err);
  $("#posts").innerHTML = `<div class="card"><p class="muted">Could not load posts.json</p></div>`;
});
