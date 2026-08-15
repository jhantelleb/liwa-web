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

// Facts (and routes, and summary items) can carry a URL two ways: an
// explicit `link` object, or just `source.url` with `source.title` as the
// label. Real Firestore data mostly only has the latter — `link` is rare —
// so every place we render a linkable fact needs to fall back to source.
function factLink(fact) {
  if (fact.link && fact.link.url) return { url: fact.link.url, label: fact.link.label || "Details" };
  if (fact.source && fact.source.url) return { url: fact.source.url, label: fact.source.title || "View source" };
  return null;
}

function renderTransportFact(fact) {
  const el = document.createElement("div");
  el.className = "transport-item";
  const link = factLink(fact);
  el.innerHTML = `
    <p>${fact.text}</p>
    ${link ? `<a href="${link.url}" target="_blank" rel="noopener">${link.label}</a>` : ""}
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
    const link = factLink(r);
    el.innerHTML = `
      <p>${r.summary}${r.durationText ? ` (${r.durationText})` : ""}</p>
      ${r.steps && r.steps.length ? `<ol class="route-steps">${r.steps.map((s) => `<li>${s}</li>`).join("")}</ol>` : ""}
      ${link ? `<a href="${link.url}" target="_blank" rel="noopener">${link.label}</a>` : ""}
    `;
    wrap.appendChild(el);
  });

  return wrap;
}

/**
 * TODO: weather is not wired up yet on the web view. venue.weather is
 * currently always null (see firestore-data.js) — there's no data source
 * behind this section at all yet, verified doors time or not. Planned:
 * OpenWeatherMap (WeatherKit, which the iOS app uses, has no public
 * client-side API — it'd need a backend proxy, so a different provider is
 * simpler for the web view). Until that's built, show an honest "in the
 * works" message instead of implying this is blocked on data verification
 * — it isn't; there's just no forecast source connected yet.
 *
 * Once OpenWeatherMap is wired up, the verified-doorsTime gate below still
 * applies (still "unknown stays unknown" — no forecast without a verified
 * anchor time), it just needs an `else` branch that actually renders
 * venue.weather instead of always hitting this message.
 */
function renderWeather(venue) {
  const block = document.getElementById("weather-block");

  block.innerHTML = `
    <p class="unknown-text">
      Weather isn't available here yet — check your preferred weather app in the meantime.
    </p>
  `;
}

const CROP_POSITION_MAP = {
  center: "center",
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
};

/**
 * Renders the venue's hero image + attribution, per the VenueArtwork
 * shape. Gracefully does nothing if artwork/hero is missing — this isn't
 * a "policy" fact needing a verification gate, just an optional asset.
 */
function renderHeroImage(venue) {
  const artwork = venue.venue.artwork;
  if (!artwork || !artwork.hero || !artwork.hero.url) return;

  const wrap = document.getElementById("hero-image-wrap");
  const img = document.getElementById("hero-image");
  img.src = artwork.hero.url;
  img.alt = `${venue.venue.venueName || "Venue"} — photo`;
  img.style.objectPosition = CROP_POSITION_MAP[artwork.hero.cropPosition] || "center";

  const attribution = artwork.attribution;
  const attrEl = document.getElementById("hero-attribution");
  if (attribution && (attribution.creator || attribution.sourceURL)) {
    const parts = [];
    if (attribution.creator) parts.push(attribution.creator);
    if (attribution.licenseName) {
      parts.push(
        attribution.licenseURL
          ? `<a href="${attribution.licenseURL}" target="_blank" rel="noopener">${attribution.licenseName}</a>`
          : attribution.licenseName
      );
    }
    let text = parts.join(", ");
    if (attribution.sourceURL) {
      text = `<a href="${attribution.sourceURL}" target="_blank" rel="noopener">${text || "Source"}</a>`;
    }
    attrEl.innerHTML = text;
  }

  wrap.hidden = false;
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

/**
 * Merch lives at venues/{venueID}.transportation.modes[id == "merch"] —
 * NOT a separate collection. Per Dexter's spec:
 * - summaryItems drive the scannable "Early" / "Show day(s)" / dated card.
 * - facts (already verified-only, filtered upstream in data-utils.js)
 *   drive "All merch details."
 * - Date grouping labels ("Early"/"Show days") are computed client-side by
 *   comparing each summaryItem's dateRange to the event's show dates —
 *   Firestore never supplies those labels directly.
 * - If summaryItems is empty but verified facts exist (e.g. a fact saying
 *   "not announced yet"), render the facts as a simple details list —
 *   do NOT fabricate a schedule card. If neither exists, show the
 *   "not announced" fallback.
 */
function classifyMerchDateRange(dateRange, showDates) {
  if (!showDates || showDates.length === 0) return { kind: "formatted" };
  const sorted = [...showDates].sort();
  const firstShow = sorted[0];
  const start = dateRange.startDate;
  const end = dateRange.endDate || dateRange.startDate;

  if (end < firstShow) return { kind: "early" };

  const overlapCount = sorted.filter((d) => d >= start && d <= end).length;
  if (overlapCount > 0) return { kind: overlapCount > 1 ? "showDays" : "showDay" };

  return { kind: "formatted" };
}

const MERCH_GROUP_LABEL = { early: "Early", showDay: "Show day", showDays: "Show days" };

function formatMerchDateRange(dateRange) {
  const dates =
    dateRange.endDate && dateRange.endDate !== dateRange.startDate
      ? [dateRange.startDate, dateRange.endDate]
      : [dateRange.startDate];
  return formatDateRange(dates);
}

function renderMerchFact(fact) {
  const el = document.createElement("div");
  el.className = "transport-item";
  const link = factLink(fact);
  el.innerHTML = `
    <p>${fact.text}</p>
    ${link ? `<a href="${link.url}" target="_blank" rel="noopener">${link.label}</a>` : ""}
  `;
  return el;
}

function renderMerch(venue) {
  const container = document.getElementById("merch-list");
  const modes = (venue.transportation && venue.transportation.modes) || [];
  const merch = modes.find((m) => m.id === "merch");

  if (!merch) {
    container.innerHTML = `<p class="unknown-text">Merch details haven't been announced yet.</p>`;
    return;
  }

  const summaryItems = merch.summaryItems || [];
  const facts = merch.facts || []; // already verified-only

  if (summaryItems.length === 0 && facts.length === 0) {
    container.innerHTML = `<p class="unknown-text">Merch details haven't been announced yet.</p>`;
    return;
  }

  if (summaryItems.length > 0) {
    const showDates = (venue.event.dates || []).slice();
    // ordered label -> { items[], kind, starts[], ends[] } — kind/starts/ends
    // let us show the real date(s) next to "Early"/"Show day(s)" labels
    // instead of just the bare label, without re-deriving it from scratch.
    const groups = new Map();
    summaryItems.forEach((item) => {
      const { kind } = classifyMerchDateRange(item.dateRange, showDates);
      const label = kind === "formatted" ? formatMerchDateRange(item.dateRange) : MERCH_GROUP_LABEL[kind];
      if (!groups.has(label)) groups.set(label, { items: [], kind, starts: [], ends: [] });
      const group = groups.get(label);
      group.items.push(item);
      group.starts.push(item.dateRange.startDate);
      group.ends.push(item.dateRange.endDate || item.dateRange.startDate);
    });

    groups.forEach(({ items, kind, starts, ends }, label) => {
      const groupEl = document.createElement("div");
      groupEl.className = "merch-group";
      const heading = document.createElement("p");
      heading.className = "merch-group-label";
      if (kind === "formatted") {
        heading.textContent = label;
      } else {
        const groupRange = {
          startDate: starts.slice().sort()[0],
          endDate: ends.slice().sort()[ends.length - 1],
        };
        heading.textContent = `${label} · ${formatMerchDateRange(groupRange)}`;
      }
      groupEl.appendChild(heading);
      items.forEach((item) => {
        const line = document.createElement("p");
        line.className = "merch-summary-line";
        const link = factLink(item);
        if (link) {
          line.innerHTML = `${item.location} · ${item.time} — <a href="${link.url}" target="_blank" rel="noopener">${link.label}</a>`;
        } else {
          line.textContent = `${item.location} · ${item.time}`;
        }
        groupEl.appendChild(line);
      });
      container.appendChild(groupEl);
    });
  } else {
    // No schedule to show (e.g. Toronto: verified facts exist saying
    // merch isn't announced yet, but no summaryItems) — don't fabricate
    // dates/times, just label what follows as general merch details.
    const note = document.createElement("p");
    note.className = "merch-group-label";
    note.textContent = "Merch details";
    container.appendChild(note);
  }

  if (facts.length > 0) {
    const details = document.createElement("details");
    details.className = "merch-details";
    const summary = document.createElement("summary");
    summary.textContent = "All merch details";
    details.appendChild(summary);
    facts.forEach((f) => details.appendChild(renderMerchFact(f)));
    container.appendChild(details);
  }
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

  renderHeroImage(venue);
  renderWeather(venue);

  const transportList = document.getElementById("transport-list");
  const t = venue.transportation;
  if (t) {
    // Merch is stored as just another entry in transportation.modes
    // (mode.id === "merch"), not a separate collection — excluded here so
    // it doesn't also show up under "Getting there"; renderMerch() below
    // finds it again and gives it its own section per Dexter's spec.
    const transportModes = t.modes.filter((m) => m.id !== "merch");

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
    transportModes.forEach((m) => transportList.appendChild(renderTransportMode(m)));
    if (!t.headline && t.origins.length === 0 && transportModes.length === 0) {
      transportList.innerHTML = `<p class="unknown-text">Transportation info for this venue hasn't been verified yet.</p>`;
    }
  }

  renderMerch(venue);

  const policyList = document.getElementById("policy-list");
  if (venue.policy.source === "none") {
    policyList.innerHTML = `<p class="unknown-text">Venue policies for this event haven't been verified yet.</p>`;
  } else {
    venue.policy.rules.forEach((r) => policyList.appendChild(renderRule(r)));
    if (venue.policy.additionalProhibitedItems.length) {
      policyList.appendChild(renderAdditionalProhibited(venue.policy.additionalProhibitedItems));
    }
  }
}

init();
