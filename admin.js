const $ = (sel) => document.querySelector(sel);

let posts = [];
let selectedIndex = -1;

function nowYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalize(s){ return (s || "").toLowerCase().trim(); }

function slugify(s) {
  return normalize(s)
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function tagsToArray(s) {
  return (s || "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

function arrayToTags(arr) {
  return (arr || []).join(", ");
}

function setStatus(msg) {
  $("#status").textContent = msg || "";
}

function loadDraft() {
  const raw = localStorage.getItem("blog_admin_draft_v1");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveDraft(data) {
  localStorage.setItem("blog_admin_draft_v1", JSON.stringify(data, null, 2));
}

function clearDraft() {
  localStorage.removeItem("blog_admin_draft_v1");
}

async function loadFromServer() {
  const res = await fetch("./posts.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load posts.json");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("posts.json must be an array");
  posts = data;
  selectedIndex = -1;
  renderList();
  showEmpty();
  setStatus("Loaded posts.json");
}

function importFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("JSON must be an array");
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsText(file);
  });
}

function exportJson() {
  // sort newest first
  const sorted = [...posts].sort((a,b) => (b.date || "").localeCompare(a.date || ""));
  const blob = new Blob([JSON.stringify(sorted, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "posts.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  setStatus("Exported posts.json (downloaded)");
}

function showEmpty() {
  $("#editorEmpty").style.display = "block";
  $("#editor").style.display = "none";
}

function showEditor() {
  $("#editorEmpty").style.display = "none";
  $("#editor").style.display = "block";
}

function renderList() {
  const q = normalize($("#filter").value);
  const list = $("#postList");
  list.innerHTML = "";

  const filtered = posts
    .map((p, idx) => ({ p, idx }))
    .filter(({p}) => {
      const hay = normalize([p.title, p.slug, (p.tags||[]).join(" "), p.excerpt].join(" "));
      return !q || hay.includes(q);
    });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="muted">No posts match.</div>`;
    return;
  }

  filtered.forEach(({p, idx}) => {
    const el = document.createElement("div");
    el.className = "card admin-item" + (idx === selectedIndex ? " active" : "");
    el.innerHTML = `
      <div class="post-meta">
        <span class="badge">${(p.date || "").toString()}</span>
        ${(p.tags || []).slice(0,3).map(t => `<span class="badge accent">#${t}</span>`).join(" ")}
      </div>
      <div style="margin-top:8px; font-weight:800;">${p.title || "(untitled)"}</div>
      <div class="muted mono" style="margin-top:6px;">${p.slug || ""}</div>
    `;
    el.addEventListener("click", () => {
      selectedIndex = idx;
      renderList();
      loadPostIntoEditor(posts[idx]);
    });
    list.appendChild(el);
  });
}

function loadPostIntoEditor(p) {
  showEditor();
  $("#title").value = p.title || "";
  $("#slug").value = p.slug || "";
  $("#date").value = p.date || "";
  $("#tags").value = arrayToTags(p.tags || []);
  $("#excerpt").value = p.excerpt || "";
  renderBlocks(p.blocks || []);
  renderPreview(p);
  setStatus("Editing post");
}

function readEditorToPost() {
  const title = $("#title").value.trim();
  const slug = $("#slug").value.trim();
  const date = $("#date").value.trim();
  const tags = tagsToArray($("#tags").value);
  const excerpt = $("#excerpt").value.trim();

  const p = posts[selectedIndex];
  p.title = title;
  p.slug = slug;
  p.date = date;
  p.tags = tags;
  p.excerpt = excerpt;
  // blocks are already updated live by block editor
  return p;
}

function ensureSelected() {
  if (selectedIndex < 0) {
    setStatus("Select a post first.");
    return false;
  }
  return true;
}

function blockTemplate(type) {
  if (type === "p") return { type:"p", text:"" };
  if (type === "h2") return { type:"h2", text:"" };
  if (type === "list") return { type:"list", items:[""] };
  if (type === "video") return { type:"video", provider:"youtube", url:"", title:"", caption:"" };
  if (type === "quote") return { type:"quote", text:"", by:"" };
  if (type === "callout") return { type:"callout", kind:"note", title:"", text:"" };
  if (type === "sources") return { type:"sources", items:[{label:"", url:"https://"}] };
  if (type === "image") return { type:"image", url:"https://", alt:"", caption:"" };
  return { type:"p", text:"" };
}

function renderBlocks(blocks) {
  const root = $("#blocks");
  root.innerHTML = "";

  blocks.forEach((b, i) => {
    const el = document.createElement("div");
    el.className = "block";

    el.innerHTML = `
      <div class="block-head">
        <div class="block-type">${b.type.toUpperCase()}</div>
        <div class="toolbar">
          <button class="button secondary mini" data-act="up">↑</button>
          <button class="button secondary mini" data-act="down">↓</button>
          <button class="button secondary mini danger" data-act="del">Delete</button>
        </div>
      </div>
      <div class="block-body" style="margin-top:10px;"></div>
    `;

    const body = el.querySelector(".block-body");

    // controls per type
    if (b.type === "p" || b.type === "h2") {
      body.innerHTML = `
        <textarea class="input" rows="3" placeholder="Text…">${b.text || ""}</textarea>
      `;
      body.querySelector("textarea").addEventListener("input", (e) => {
        b.text = e.target.value;
        refreshPreview();
      });
    }

    if (b.type === "list") {
      body.innerHTML = `
        <div class="help">One item per line.</div>
        <textarea class="input" rows="5" placeholder="Item 1&#10;Item 2">${(b.items || []).join("\n")}</textarea>
      `;
      body.querySelector("textarea").addEventListener("input", (e) => {
        b.items = e.target.value.split("\n").map(s => s.trim()).filter(Boolean);
        refreshPreview();
      });
    }

    if (b.type === "video") {
      body.innerHTML = `
        <div class="row">
          <select class="select">
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
            <option value="rumble">Rumble (link button)</option>
            <option value="odysee">Odysee (link button)</option>
          </select>
          <input class="input mono" placeholder="https://..." value="${b.url || ""}" />
        </div>
        <div class="row">
          <input class="input" placeholder="Title (optional)" value="${b.title || ""}" />
          <input class="input" placeholder="Caption (optional)" value="${b.caption || ""}" />
        </div>
      `;
      const sel = body.querySelector("select");
      sel.value = b.provider || "youtube";
      sel.addEventListener("change", e => { b.provider = e.target.value; refreshPreview(); });

      const [url, title, caption] = body.querySelectorAll("input");
      url.addEventListener("input", e => { b.url = e.target.value; refreshPreview(); });
      title.addEventListener("input", e => { b.title = e.target.value; refreshPreview(); });
      caption.addEventListener("input", e => { b.caption = e.target.value; refreshPreview(); });
    }

    if (b.type === "quote") {
      body.innerHTML = `
        <textarea class="input" rows="3" placeholder="Quote…">${b.text || ""}</textarea>
        <input class="input" placeholder="By (optional)" value="${b.by || ""}" style="margin-top:10px;" />
      `;
      const ta = body.querySelector("textarea");
      const by = body.querySelector("input");
      ta.addEventListener("input", e => { b.text = e.target.value; refreshPreview(); });
      by.addEventListener("input", e => { b.by = e.target.value; refreshPreview(); });
    }

    if (b.type === "callout") {
      body.innerHTML = `
        <div class="row">
          <select class="select">
            <option value="note">Note</option>
            <option value="hot">Hot take</option>
          </select>
          <input class="input" placeholder="Title (optional)" value="${b.title || ""}" />
        </div>
        <textarea class="input" rows="3" placeholder="Callout text…">${b.text || ""}</textarea>
      `;
      const sel = body.querySelector("select");
      const title = body.querySelector("input");
      const ta = body.querySelector("textarea");
      sel.value = b.kind || "note";
      sel.addEventListener("change", e => { b.kind = e.target.value; refreshPreview(); });
      title.addEventListener("input", e => { b.title = e.target.value; refreshPreview(); });
      ta.addEventListener("input", e => { b.text = e.target.value; refreshPreview(); });
    }

    if (b.type === "sources") {
      const items = b.items || [];
      const lines = items.map(x => `${x.label || ""} | ${x.url || ""}`).join("\n");
      body.innerHTML = `
        <div class="help">One source per line: <span class="mono">Label | https://link</span></div>
        <textarea class="input" rows="6" placeholder="Official report | https://...">${lines}</textarea>
      `;
      body.querySelector("textarea").addEventListener("input", e => {
        const parsed = e.target.value.split("\n").map(line => {
          const [label, url] = line.split("|").map(s => (s || "").trim());
          if (!label && !url) return null;
          return { label: label || url || "", url: url || "" };
        }).filter(Boolean);
        b.items = parsed;
        refreshPreview();
      });
    }

    if (b.type === "image") {
      body.innerHTML = `
        <div class="row">
          <input class="input mono" placeholder="https://image..." value="${b.url || ""}" />
          <input class="input" placeholder="Alt text" value="${b.alt || ""}" />
        </div>
        <input class="input" placeholder="Caption (optional)" value="${b.caption || ""}" />
      `;
      const [url, alt, cap] = body.querySelectorAll("input");
      url.addEventListener("input", e => { b.url = e.target.value; refreshPreview(); });
      alt.addEventListener("input", e => { b.alt = e.target.value; refreshPreview(); });
      cap.addEventListener("input", e => { b.caption = e.target.value; refreshPreview(); });
    }

    // block actions
    el.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.act;
        const arr = posts[selectedIndex].blocks;

        if (act === "del") {
          arr.splice(i, 1);
        } else if (act === "up" && i > 0) {
          [arr[i-1], arr[i]] = [arr[i], arr[i-1]];
        } else if (act === "down" && i < arr.length - 1) {
          [arr[i+1], arr[i]] = [arr[i], arr[i+1]];
        }
        renderBlocks(arr);
        refreshPreview();
      });
    });

    root.appendChild(el);
  });

  if (blocks.length === 0) {
    root.innerHTML = `<div class="muted">No blocks yet. Use “Add block”.</div>`;
  }
}

function escapeHtml(s){
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeUrl(url){
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch { return null; }
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
  const parts = u.pathname.spli
