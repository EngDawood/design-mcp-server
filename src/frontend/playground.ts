/**
 * Playground page (/playground): a working live Iconify search that runs
 * entirely in the browser against the public Iconify API
 * (https://api.iconify.design/search). No Worker route is involved.
 *
 * Id grounding: Iconify's search returns icon names as "<prefix>:<name>"
 * (e.g. "mdi:home"); the server's Iconify provider builds asset ids as
 * "iconify:" + that name (src/providers/iconify.ts), and get_asset routes
 * on exactly that prefix (src/tools/get-asset.ts, whose own example is
 * 'iconify:mdi:home'). Clicking a result copies that id; the card's second
 * button fetches and copies the SVG markup instead.
 *
 * Safety: the query goes through encodeURIComponent, and every result is
 * built with createElement + textContent — user input and API results are
 * never injected via innerHTML.
 */
import { SERVER_NAME, VERSION } from "../constants.js";
import { layout } from "./layout.js";

// NOTE: this script is embedded in a template literal — it must not contain
// backticks or "${" sequences. Plain string concatenation only.
const PLAYGROUND_SCRIPT = `
var form = document.getElementById("pg-form");
var input = document.getElementById("pg-query");
var statusEl = document.getElementById("pg-status");
var grid = document.getElementById("pg-grid");

function svgUrl(icon) {
  var parts = icon.split(":");
  return "https://api.iconify.design/" + parts[0] + "/" + parts.slice(1).join(":") + ".svg";
}

function copyText(text, label) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    statusEl.textContent = label + ": " + text;
    return;
  }
  navigator.clipboard.writeText(text).then(function () {
    statusEl.textContent = "Copied " + label + ": " + text;
  }, function () {
    statusEl.textContent = label + ": " + text;
  });
}

function renderCard(icon) {
  var card = document.createElement("div");
  card.className = "icon-card";
  var img = document.createElement("img");
  img.src = svgUrl(icon);
  img.alt = icon;
  img.loading = "lazy";
  var label = document.createElement("span");
  label.textContent = icon;
  var copyId = document.createElement("button");
  copyId.type = "button";
  copyId.textContent = "Copy get_asset id";
  copyId.addEventListener("click", function () {
    copyText("iconify:" + icon, "get_asset id");
  });
  var copySvg = document.createElement("button");
  copySvg.type = "button";
  copySvg.textContent = "Copy SVG";
  copySvg.addEventListener("click", function () {
    fetch(svgUrl(icon)).then(function (res) { return res.text(); }).then(function (svg) {
      copyText(svg, "SVG");
    }, function () {
      statusEl.textContent = "Could not fetch the SVG for " + icon + ".";
    });
  });
  card.appendChild(img);
  card.appendChild(label);
  card.appendChild(copyId);
  card.appendChild(copySvg);
  return card;
}

form.addEventListener("submit", function (event) {
  event.preventDefault();
  var query = input.value.trim();
  if (!query) return;
  statusEl.textContent = "Searching Iconify...";
  grid.textContent = "";
  var url = "https://api.iconify.design/search?query=" + encodeURIComponent(query) + "&limit=48";
  fetch(url).then(function (res) {
    if (!res.ok) throw new Error("Iconify API error: " + res.status);
    return res.json();
  }).then(function (data) {
    var icons = data.icons || [];
    if (icons.length === 0) {
      statusEl.textContent = "No icons found for that search.";
      return;
    }
    statusEl.textContent = "Found " + (data.total || icons.length) + " icons. " +
      "Copy a get_asset id, then call the get_asset tool with it over MCP.";
    icons.forEach(function (icon) { grid.appendChild(renderCard(icon)); });
  }).catch(function (err) {
    statusEl.textContent = "Search failed: " + err.message;
  });
});
`;

export function playgroundPage(): string {
  const body = `
<h1>Playground</h1>
<p>Live search against the public <strong>Iconify API</strong>, running in
your browser — the same source the server's <code>iconify</code> provider
searches. Each result's <code>get_asset</code> id is
<code>iconify:&lt;prefix&gt;:&lt;name&gt;</code> (for example
<code>iconify:mdi:home</code>): copy one and pass it to the
<code>get_asset</code> tool over MCP, or copy the SVG markup directly.</p>
<form id="pg-form">
  <input id="pg-query" type="search" name="query" placeholder="Search icons — e.g. home, rocket, settings" aria-label="Icon search query">
  <button type="submit">Search</button>
</form>
<p id="pg-status" class="muted" role="status"></p>
<div id="pg-grid" class="icon-grid"></div>
<script>${PLAYGROUND_SCRIPT}</script>`;

  return layout({
    title: "Playground",
    page: "playground",
    serverName: SERVER_NAME,
    version: VERSION,
    body,
  });
}
