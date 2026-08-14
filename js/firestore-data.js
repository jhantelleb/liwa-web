/**
 * Real Firestore reads for the read-only web view, staging project
 * (liwa-staging) by default — see firebase-config.js.
 *
 * NOTE: I could not test this against your live Firestore from the sandbox
 * this was built in — firestore.googleapis.com and gstatic.com are both
 * unreachable from that environment. This is written carefully against the
 * collection paths and query patterns you gave me, but it is UNVERIFIED.
 * Open live.html in an actual browser and check the console for errors —
 * a "permission-denied" error most likely means the Firestore security
 * rules don't yet allow unauthenticated client reads (you flagged this as
 * an open question earlier). Report back what you see and I'll fix it.
 *
 * Collection paths (as given):
 *   events/{eventID}
 *   venues/{venueID}
 *   venuePolicies/{venueID}            (direct read by ID)
 *     fallback: venuePolicies where venueName == <name> limit 1
 *   eventPolicyOverrides                (queried by fields, not nested)
 *     where venueID == <venueID> where eventID == <eventID>
 *
 * Since the web view doesn't hardcode which event/venue is "currently
 * live," this resolves it by venue NAME first (see VENUE_NAME below) —
 * swap that for an explicit venueID/eventID once you'd rather pin it.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./firebase-config.js";
import { resolvePolicy, filterTransportationForDisplay } from "./data-utils.js";

// The venue this deployment of the web view shows. Update this (or wire up
// real venue selection) as more venues go live.
const VENUE_NAME = "AT&T Stadium";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

// Exposed so live.js can show an on-page "where did this data come from"
// badge without needing DevTools.
export const PROJECT_ID = FIREBASE_CONFIG.projectId;

function firstDocId(snap) {
  let id = null;
  snap.forEach((d) => {
    if (id === null) id = d.id;
  });
  return id;
}

function firstDocData(snap) {
  let data = null;
  snap.forEach((d) => {
    if (data === null) data = { _id: d.id, ...d.data() };
  });
  return data;
}

/**
 * Finds the current (non-hidden) event for VENUE_NAME. Handles the
 * FirestoreEvent field-name fallbacks (venueID/venueId, eventID/runId).
 */
async function findCurrentEvent() {
  const eventsRef = collection(db, "events");
  const q = query(eventsRef, where("venueName", "==", VENUE_NAME), where("isHidden", "==", false), limit(1));
  const snap = await getDocs(q);
  const event = firstDocData(snap);
  if (!event) return null;

  event.eventID = event.eventID || event.runId || event._id;
  event.venueID = event.venueID || event.venueId;
  return event;
}

async function fetchVenue(venueID) {
  const snap = await getDoc(doc(db, "venues", venueID));
  if (!snap.exists()) return null;
  const venue = snap.data();
  venue.venueID = venue.venueID || venue.venueId || venue.id || venueID;
  venue.venueName = venue.venueName || venue.name;
  return venue;
}

async function fetchVenuePolicy(venueID, venueName) {
  // Preferred: direct read by ID. A get() is checked against the rule
  // using the DOCUMENT'S ACTUAL DATA, so no matching where() filter is
  // needed here — unlike the query below.
  const directSnap = await getDoc(doc(db, "venuePolicies", venueID));
  if (directSnap.exists()) return directSnap.data();

  // Fallback: query by venueName. IMPORTANT: Firestore rejects an entire
  // query up front unless its where() filters structurally guarantee every
  // possible result satisfies the security rule — it does NOT run the
  // query and then filter by the rule for you. The venuePolicies rule
  // requires BOTH trustStatus == "curatedOfficial" AND status !=
  // "unavailable", so both need to appear in the query. Combining an
  // equality and an inequality filter on different fields may prompt
  // Firestore to ask you to create a composite index the first time this
  // path actually runs (a separate, clearer error than permission-denied,
  // with a direct link to create it) — that's expected, not a bug, if it
  // happens. This fallback only runs if the direct get() above misses, so
  // it's untested in practice so far.
  const q = query(
    collection(db, "venuePolicies"),
    where("venueName", "==", venueName),
    where("trustStatus", "==", "curatedOfficial"),
    where("status", "!=", "unavailable"),
    limit(1)
  );
  const snap = await getDocs(q);
  return firstDocData(snap);
}

async function fetchEventOverrides(venueID, eventID) {
  // Same rule-matching requirement as above: the eventPolicyOverrides
  // rule requires status != "unavailable", so the query must include that
  // exact filter or Firestore rejects the whole query, not just filters
  // out the non-matching documents.
  const q = query(
    collection(db, "eventPolicyOverrides"),
    where("venueID", "==", venueID),
    where("eventID", "==", eventID),
    where("status", "!=", "unavailable")
  );
  const snap = await getDocs(q);
  const overrides = [];
  snap.forEach((d) => overrides.push({ id: d.id, ...d.data() }));
  return overrides;
}

export async function getVenueData() {
  const event = await findCurrentEvent();
  if (!event) {
    throw new Error(`No visible event found for venue "${VENUE_NAME}". Check isHidden and venueName fields.`);
  }

  const [venue, venuePolicy, overrides] = await Promise.all([
    fetchVenue(event.venueID),
    fetchVenuePolicy(event.venueID, VENUE_NAME),
    fetchEventOverrides(event.venueID, event.eventID),
  ]);

  if (!venue) {
    throw new Error(`venues/${event.venueID} not found.`);
  }

  const policy = resolvePolicy(event.venueID, event.eventID, venuePolicy, overrides);

  return {
    event,
    venue,
    policy,
    transportation: filterTransportationForDisplay(venue.transportation),
    weather: null, // unknown until doorsTime.verified — see live.js renderWeather()
  };
}
