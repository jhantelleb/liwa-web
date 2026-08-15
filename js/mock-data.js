/**
 * Mock data for local dev/testing of the read-only web view, with no
 * network dependency. Shaped against the real Firestore domain types:
 *
 *   events/{eventID}          -> FirestoreEvent
 *   venues/{venueID}          -> FirestoreVenue (includes VenueTransportation)
 *   venuePolicies/{venueID}   -> VenuePolicy (doc-level status/confidence/trustStatus)
 *   eventPolicyOverrides/{id} -> EventPolicyOverride (authority-ranked overrides)
 *
 * Filtering/merge logic (resolvePolicy, filterTransportationForDisplay) is
 * shared with firestore-data.js via data-utils.js — this file only supplies
 * fixture data and returns it through getVenueData(), matching the exact
 * shape firestore-data.js produces so live.js works against either.
 */
import { resolvePolicy, filterTransportationForDisplay } from "./data-utils.js";

// events/{eventID}
const MOCK_EVENT = {
  eventID: "evt-att-2026-08-15",
  artist: "Live event",
  venueID: "att-stadium-arlington",
  isHidden: false,
  dates: ["2026-08-15", "2026-08-16"],
  shows: [
    {
      id: "show-2026-08-15",
      date: "2026-08-15",
      startTime: { value: null, timezone: "America/Chicago", verified: false, fallbackText: null },
      // doorsTime unverified — the weather block gates on this. No value,
      // no fallback guess: "unknown stays unknown."
      doorsTime: { value: null, timezone: "America/Chicago", verified: false, fallbackText: null },
      parkingOpensTime: { value: null, timezone: "America/Chicago", verified: false, fallbackText: null },
    },
  ],
};

// venues/{venueID}
const MOCK_VENUE = {
  venueID: "att-stadium-arlington",
  venueName: "AT&T Stadium",
  address: "1 AT&T Way, Arlington, TX 76011",
  city: "Arlington",
  state: "TX",
  country: "US",
  coordinates: { latitude: 32.7473, longitude: -97.0945 },
  artwork: {
    hero: {
      url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1280&h=720&fit=crop",
      width: 1280,
      height: 720,
      cropPosition: "center",
    },
    thumbnail: {
      url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=330&h=220&fit=crop",
      width: 330,
      height: 220,
      cropPosition: "center",
    },
    attribution: {
      creator: "Test Photographer",
      licenseName: "CC BY-SA 4.0",
      licenseURL: "https://creativecommons.org/licenses/by-sa/4.0/",
      sourceURL: "https://commons.wikimedia.org/wiki/File:Example.jpg",
      isCropped: true,
    },
  },
  transportation: {
    lastVerifiedAt: "2026-08-10",
    headline: {
      text: "Multiple ways to reach AT&T Stadium for game day, including shuttle, rideshare, and on-site parking.",
      provenance: "official",
      verified: true,
      source: {
        title: "AT&T Stadium — Getting Here",
        url: "https://www.attstadium.com/directions/",
        type: "officialWebsite",
        excerpt: "Plan your trip to AT&T Stadium.",
      },
    },
    deepLinks: {
      appleMaps: "https://maps.apple.com/?address=1+AT%26T+Way,+Arlington,+TX+76011",
      googleMaps: "https://www.google.com/maps/search/?api=1&query=AT%26T+Stadium+Arlington+TX",
    },
    origins: [
      {
        id: "downtown-dallas",
        label: "From Downtown Dallas",
        order: 1,
        routes: [
          {
            id: "route-i30",
            summary: "Take I-30 W to Stadium exits",
            durationText: "~25 min",
            modeId: "driving",
            steps: ["Merge onto I-30 W", "Exit at the Stadium exits", "Follow signs to parking lots"],
            link: { label: "Directions", url: "https://www.attstadium.com/directions/" },
            provenance: "official",
            verified: true,
            source: {
              title: "AT&T Stadium — Directions",
              url: "https://www.attstadium.com/directions/",
              type: "officialWebsite",
              excerpt: "Directions from Downtown Dallas.",
            },
          },
        ],
      },
    ],
    modes: [
      {
        id: "shuttle",
        label: "Shuttle",
        facts: [
          {
            id: "jgilligans-shuttle",
            text: "Round-trip shuttle service to AT&T Stadium from J. Gilligan's, run on event days.",
            scope: "allEvents",
            provenance: "official",
            highlight: true,
            verified: true,
            reviewStatus: "curated",
            verifiedAt: "2026-08-10",
            verifiedBy: "jhantelle",
            link: { label: "Shuttle info", url: "https://www.jgilligans.com/shuttle" },
            source: {
              title: "J. Gilligan's Bar & Grill",
              url: "https://www.jgilligans.com/shuttle",
              type: "thirdParty",
              excerpt: "Shuttle service details.",
            },
          },
        ],
      },
      {
        id: "parking",
        label: "Parking",
        summaryItems: [
          {
            dateRange: { startDate: "2026-08-15", endDate: "2026-08-16" },
            location: "Official stadium lots",
            time: "Opens ~4 hours before doors",
            locationType: "exterior",
          },
        ],
        facts: [
          {
            id: "official-lots",
            text: "On-site lots open approximately 4 hours before doors. Prepaid parking recommended.",
            provenance: "official",
            verified: true,
            link: { label: "Parking info", url: "https://www.attstadium.com/parking/" },
            source: {
              title: "AT&T Stadium — Parking",
              url: "https://www.attstadium.com/parking/",
              type: "officialWebsite",
              excerpt: "Parking lot hours and rates.",
            },
          },
          // Example of a fact that must NOT reach the UI — unverified,
          // included so the filter in data-utils.js has something to catch.
          {
            id: "rideshare-rumor",
            text: "Rideshare pickup is supposedly at Gate C, per a fan forum post.",
            provenance: "community",
            verified: false,
            source: {
              title: "Fan forum thread",
              type: "thirdParty",
              excerpt: "Unverified rideshare pickup claim.",
            },
          },
        ],
      },
      {
        // Merch lives in the SAME transportation.modes array, id "merch"
        // — not a separate collection. Confirmed by Jhantelle.
        id: "merch",
        label: "Merch",
        summaryItems: [
          {
            dateRange: { startDate: "2026-08-14", endDate: "2026-08-14" },
            location: "Choctaw Stadium",
            time: "10 AM – 6 PM",
            locationType: "exterior",
          },
          {
            dateRange: { startDate: "2026-08-15", endDate: "2026-08-16" },
            location: "Choctaw Stadium (exterior)",
            time: "10 AM – 6:30 PM",
            locationType: "exterior",
          },
          {
            dateRange: { startDate: "2026-08-15", endDate: "2026-08-16" },
            location: "AT&T Stadium (interior)",
            time: "GA doors – after show",
            locationType: "interior",
          },
        ],
        facts: [
          {
            id: "weverse-pickup",
            text: "Weverse Shop pickup is at Esports Stadium Arlington, 1200 Ballpark Way, from Friday, August 14 through Sunday, August 16, 11:00 AM to 6:00 PM CDT. Pickup purchases and timeslot reservations are handled exclusively through Weverse.",
            provenance: "official",
            verified: true,
            link: { label: "Weverse Arlington pickup notice", url: "https://weverseshop.io" },
            source: {
              title: "Weverse Arlington Pickup Notice",
              url: "https://weverseshop.io",
              type: "officialWebsite",
              excerpt: "Pickup location and hours.",
            },
          },
          {
            id: "interior-merch",
            text: "Interior AT&T Stadium merchandise runs from GA doors through after the show at East Plaza, West Plaza, Sections 220, 225, 245, 250, 401, 424, 431, 454, Club South, and Club North. Merchandise sales are cashless — credit/debit cards and Apple Pay, Samsung Pay, or Google Pay are accepted.",
            provenance: "official",
            verified: true,
            source: {
              title: "Weverse Arlington Merchandise Notice",
              url: "https://weverseshop.io",
              type: "officialWebsite",
              excerpt: "Interior merch booth locations and payment info.",
            },
          },
        ],
      },
    ],
  },
};

// venuePolicies/{venueID} — verification status lives HERE, at doc level.
const MOCK_VENUE_POLICY = {
  venueID: "att-stadium-arlington",
  venueName: "AT&T Stadium",
  confidence: "high",
  status: "verified",
  trustStatus: "curatedOfficial",
  lastCheckedAt: "2026-08-10",
  source: {
    title: "AT&T Stadium — Guest Services",
    url: "https://www.attstadium.com/guest-services/faq/",
    type: "guestServices",
  },
  rules: [
    {
      id: "bags",
      category: "bags",
      item: "Bags",
      allowance: "conditional",
      condition: "Clear bags only, 12\" x 6\" x 12\" max, or a small clutch no larger than 4.5\" x 6.5\".",
      displayLevel: "primary",
      source: {
        title: "AT&T Stadium — Bag Policy",
        url: "https://www.attstadium.com/guest-services/bag-policy/",
        type: "guestServices",
      },
    },
    {
      id: "re-entry",
      category: "miscellaneous",
      item: "Re-entry",
      allowance: "prohibited",
      notes: "No re-entry once you exit the stadium.",
      displayLevel: "primary",
      source: {
        title: "AT&T Stadium — FAQ",
        url: "https://www.attstadium.com/guest-services/faq/",
        type: "faq",
      },
    },
    {
      id: "cameras",
      category: "cameras",
      item: "Cameras & drones",
      allowance: "conditional",
      condition: "No professional cameras (detachable lens) or drones.",
      displayLevel: "standard",
      source: {
        title: "AT&T Stadium — FAQ",
        url: "https://www.attstadium.com/guest-services/faq/",
        type: "faq",
      },
    },
    {
      id: "food-drink",
      category: "foodDrink",
      item: "Outside food & drink",
      allowance: "prohibited",
      displayLevel: "standard",
      source: {
        title: "AT&T Stadium — FAQ",
        url: "https://www.attstadium.com/guest-services/faq/",
        type: "faq",
      },
    },
  ],
};

// eventPolicyOverrides/{id} — three fixtures included specifically to
// exercise the merge rules confirmed by Dexter (see data-utils.js resolvePolicy):
//  1. An officialVenue override that CHANGES an existing rule (cameras) —
//     official overrides win over matching base venue rules.
//  2. A communityReport override that ADDS a rule for a category the base
//     policy has no entry for (electronics) — community fills gaps.
//  3. A communityReport override that TRIES to change an existing official
//     rule (re-entry) — must be ignored; community can't override known rules.
const MOCK_EVENT_OVERRIDES = [
  {
    id: "override-cameras-event",
    eventID: "evt-att-2026-08-15",
    venueID: "att-stadium-arlington",
    authority: "officialVenue",
    status: "verified",
    source: {
      title: "AT&T Stadium — Event-Specific Camera Policy",
      url: "https://www.attstadium.com/guest-services/faq/",
      type: "officialWebsite",
    },
    rules: [
      {
        id: "cameras",
        category: "cameras",
        item: "Cameras & drones",
        allowance: "conditional",
        condition: "Non-professional cameras allowed for this event; no detachable lenses, tripods, or drones.",
        displayLevel: "standard",
        source: {
          title: "AT&T Stadium — Event-Specific Camera Policy",
          url: "https://www.attstadium.com/guest-services/faq/",
          type: "officialWebsite",
        },
      },
    ],
  },
  {
    id: "override-electronics-community",
    eventID: "evt-att-2026-08-15",
    venueID: "att-stadium-arlington",
    authority: "communityReport",
    status: "partiallyVerified",
    source: {
      title: "Fan report thread",
      url: "https://example-fan-forum.com/thread/att-stadium-chargers",
      type: "thirdParty",
    },
    rules: [
      {
        id: "portable-chargers",
        category: "electronics",
        item: "Portable phone chargers",
        allowance: "allowed",
        notes: "Reported allowed by attendees; not confirmed on an official source.",
        displayLevel: "standard",
        source: {
          title: "Fan report thread",
          url: "https://example-fan-forum.com/thread/att-stadium-chargers",
          type: "thirdParty",
        },
      },
    ],
  },
  {
    id: "override-reentry-community-rejected",
    eventID: "evt-att-2026-08-15",
    venueID: "att-stadium-arlington",
    authority: "communityReport",
    status: "partiallyVerified",
    source: { title: "Fan forum post", type: "thirdParty" },
    rules: [
      {
        // Same category+item as the base "re-entry" rule — this MUST NOT
        // win, since re-entry is already a known official rule.
        id: "re-entry",
        category: "miscellaneous",
        item: "Re-entry",
        allowance: "allowed",
        notes: "A fan claimed re-entry was allowed with a hand stamp — unconfirmed, contradicts the official policy.",
        displayLevel: "primary",
        source: { title: "Fan forum post", type: "thirdParty" },
      },
    ],
  },
];

/**
 * Simulates an async data fetch so this and firestore-data.js are
 * interchangeable from live.js's point of view.
 */
export function getVenueData() {
  const policy = resolvePolicy(MOCK_VENUE.venueID, MOCK_EVENT.eventID, MOCK_VENUE_POLICY, MOCK_EVENT_OVERRIDES);

  const venue = {
    event: MOCK_EVENT,
    venue: MOCK_VENUE,
    policy,
    transportation: filterTransportationForDisplay(MOCK_VENUE.transportation),
    weather: null, // unknown until doorsTime.verified — see live.js renderWeather()
  };
  return Promise.resolve(venue);
}
