/**
 * Data source toggle: append ?mock=1 to the URL to force local mock data
 * (no network / Firestore needed) — useful for testing the UI in isolation.
 * Otherwise this reads live from Firestore (staging, per firebase-config.js).
 */
const USE_MOCK = new URLSearchParams(window.location.search).has("mock");
const dataModule = USE_MOCK ? await import("./mock-data.js") : await import("./firestore-data.js");
const getVenueData = dataModule.getVenueData;

const CATEGORY_LABEL = {
  bags: "Bags",
  cameras: "Cameras",
  electronics: "Electronics",
  foodDrink: "Food & drink",
  medical: "Medical",
  signs: "Signs",
  clothing: "Clothing",
  sports: "Sports equipment",
  miscellaneous: "Miscellaneous",
};

const ALLOWANCE_LABEL = {
  allowed: "Allowed",
  prohibited: "Prohibited",
  conditional: "Conditional",
  unknown: "Unknown",
};

function renderRule(rule) {
  const el = document.createElement("div");
  el.className = "policy-item";
  const detail = rule.condition || rule.notes || "";
  el.innerHTML = `
    <div class="policy-item-head">
      <span class="policy-category">${rule.item || CATEGORY_LABEL[rule.category] || rule.category}</span>
      <span class="allowance-badge allowance-${rule.allowance}">${ALLOWANCE_LABEL[rule.allowance] || rule.allowance}</span>
    </div>
    ${detail ? `<p class="policy-fact">${detail}</p>` : ""}
    ${rule.source && rule.source.url ? `<a class="policy-source" href="${rule.source.url}" target="_blank" rel="noopener">View source</a>` : ""}
  `;
  return el;
}

function renderAdditionalProhibited(items) {
  const el = document.createElement("div");
  el.className = "policy-item";
  el.innerHTML = `
    <div class="policy-item-head">
      <span class="policy-category">Additional prohibited items for this event</span>
    </div>
    <p class="policy-fact">${items.join(", ")}</p>
  `;
  return el;
}

function renderTransportFact(fact) {
  const el = document.createElement("div");
  el.className = "transport-item";
  el.innerHTML = `
    <p>${fact.text}</p>
    ${fact.link ? `<a href="${fact.link.url}" target="_blank" rel="noopener">${fact.link.label}</a>` : ""}
  `;
  return el;
}

function renderTransportMode(mode) {
  const wrap = document.createElement("div");
  wrap.className = "transport-mode";

  const heading = document.createElement("h3");
  heading.textContent = mode.label;
  wrap.appendChild(heading);

  (mode.summaryItems || []).forEach((s) => {
    const p = document.createElement("p");
    p.className = "transport-summary";
    p.textContent = `${s.location} — ${s.time}`;
    wrap.appendChild(p);
  });

  (mode.facts || []).forEach((f) => wrap.appendChild(renderTransportFact(f)));

  return wrap;
}

function renderOrigin(origin) {
  const wrap = document.createElement("div");
  wrap.className = "transport-mode";

  const heading = document.createElement("h3");
  heading.textContent = origin.label;
  wrap.appendChild(heading);

  origin.routes.forEach((r) => {
    const el = document.createElement("div");
    el.className = "transport-item";
    el.innerHTML = `
      <p>${r.summary}${r.durationText ? ` (${r.durationText})` : ""}</p>
      ${r.steps && r.steps.length ? `<ol class="route-steps">${r.steps.map((s) => `<li>${s}</li>`).join("")}</ol>` : ""}
      ${r.link ? `<a href="${r.link.url}" target="_blank" rel="noopener">${r.link.label}</a>` : ""}
    `;
    wrap.appendChild(el);
  });

  return wrap;
}

/**
 * Weather is gated on FirestoreShowTime.verified for doorsTime — not just
 * presence of a value. An unverified value or a fallbackText string is
 * NOT treated as good enough to anchor a forecast: "unknown stays unknown"
 * means we wait for a verified doors time, same as the app does.
 */
function renderWeather(venue) {
  const block = document.getElementById("weather-block");
  const shows = venue.event.shows || [];
  const hasVerifiedDoors = shows.some((s) => s.doorsTime && s.doorsTime.verified && s.doorsTime.value);

  if (!hasVerifiedDoors || !venue.weather) {
    block.innerHTML = `
      <p class="unknown-text">
        Weather isn't available yet — doors time hasn't been verified for this event.
        Once it's confirmed, we'll show a forecast anchored to that window instead of a
        generic daily outlook.
      </p>
    `;
    return;
  }
  block.textContent = venue.weather;
}

function formatDateRange(dates) {
  if (!dates || dates.length === 0) return "";
  const parts = (iso) => iso.split("-").map(Number); // [year, month, day]
  const monthDay = ([, m, d]) =>
    new Date(Date.UTC(2000, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const dayOnly = ([, , d]) => String(d);

  const first = parts(dates[0]);
  const last = parts(dates[dates.length - 1]);
  const year = first[0];

  if (dates.length === 1) return `${monthDay(first)}, ${year}`;
  const sameMonth = first[1] === last[1];
  const lastLabel = sameMonth ? dayOnly(last) : monthDay(last);
  return `${monthDay(first)}–${lastLabel}, ${year}`;
}

function setDebugBadge(text) {
  const badge = document.getElementById("debug-badge");
  if (badge) badge.textContent = text;
}

async function init() {
  const sourceLabel = USE_MOCK
    ? "Data source: MOCK data (?mock=1 in URL) — not from Firestore."
    : `Data source: LIVE Firestore read — project "${dataModule.PROJECT_ID || "unknown"}".`;

  let venue;
  try {
    venue = await getVenueData();
  } catch (err) {
    console.error("Failed to load venue data:", err);
    const loading = document.getElementById("venue-loading");
    loading.textContent =
      "Couldn't load venue info right now. If you're seeing a permission-denied error in the console, the Firestore security rules likely need to allow public reads for this data. Add ?mock=1 to the URL to preview with sample data.";
    loading.insertAdjacentHTML(
      "beforeend",
      `<br><br><small>${sourceLabel} — read FAILED: ${String(err.message || err)}</small>`
    );
    return;
  }

  document.getElementById("venue-loading").hidden = true;
  const content = document.getElementById("venue-content");
  content.hidden = false;
  setDebugBadge(`${sourceLabel} Read succeeded.`);

  document.getElementById("venue-name").textContent = `${venue.venue.venueName} — ${venue.venue.city}, ${venue.venue.state || ""}`.trim();
  document.getElementById("venue-meta").textContent = formatDateRange(venue.event.dates);

  const policyList = document.getElementById("policy-list");
  if (venue.policy.source === "none") {
    policyList.innerHTML = `<p class="unknown-text">Venue policies for this event haven't been verified yet.</p>`;
  } else {
    venue.policy.rules.forEach((r) => policyList.appendChild(renderRule(r)));
    if (venue.policy.additionalProhibitedItems.length) {
      policyList.appendChild(renderAdditionalProhibited(venue.policy.additionalProhibitedItems));
    }
  }

  renderWeather(venue);

  const transportList = document.getElementById("transport-list");
  const t = venue.transportation;
  if (t) {
    if (t.headline) {
      const p = document.createElement("p");
      p.className = "transport-headline";
      p.textContent = t.headline.text;
      transportList.appendChild(p);
    }
    if (t.deepLinks && (t.deepLinks.appleMaps || t.deepLinks.googleMaps)) {
      const linksWrap = document.createElement("div");
      linksWrap.className = "deep-links";
      if (t.deepLinks.appleMaps) linksWrap.innerHTML += `<a href="${t.deepLinks.appleMaps}" target="_blank" rel="noopener">Apple Maps</a>`;
      if (t.deepLinks.googleMaps) linksWrap.innerHTML += `<a href="${t.deepLinks.googleMaps}" target="_blank" rel="noopener">Google Maps</a>`;
      transportList.appendChild(linksWrap);
    }
    t.origins.forEach((o) => transportList.appendChild(renderOrigin(o)));
    t.modes.forEach((m) => transportList.appendChild(renderTransportMode(m)));
    if (!t.headline && t.origins.length === 0 && t.modes.length === 0) {
      transportList.innerHTML = `<p class="unknown-text">Transportation info for this venue hasn't been verified yet.</p>`;
    }
  }
}

init();
