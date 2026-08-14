/**
 * Shared "unknown stays unknown" filtering/merge logic for the read-only
 * web view. Used by BOTH mock-data.js (local dev/testing, no network) and
 * firestore-data.js (real staging/production reads), so the display rules
 * are defined exactly once and can't drift between the two.
 */

export const AUTHORITY_RANK = {
  officialEvent: 0,
  officialVenue: 1,
  officialPromoter: 2,
  officialTicketProvider: 3,
  communityReport: 4,
};

export function ruleKey(rule) {
  return `${rule.category}|${(rule.item || "").trim().toLowerCase()}`;
}

/**
 * EventPolicyOverride precedence (confirmed by Dexter):
 *   officialEvent > officialVenue > officialPromoter > officialTicketProvider > communityReport
 *
 * Overrides are merged into the base venue policy RULE-BY-RULE, not used as
 * a full replacement. Official override rules win over matching base venue
 * rules. Community reports are supporting evidence only: they can fill
 * missing/unknown rules but cannot override a rule the base policy or an
 * official override already has an answer for.
 *
 * The base VenuePolicy must still pass its own doc-level trustStatus/status
 * gate to be shown at all — "unknown stays unknown" applies there first.
 */
export function resolvePolicy(venueID, eventID, venuePolicy, overrides) {
  const venuePolicyIsCurated =
    venuePolicy && venuePolicy.trustStatus === "curatedOfficial" && venuePolicy.status !== "unavailable";

  if (!venuePolicyIsCurated) {
    // No curated base to merge onto — show nothing rather than a
    // partially-reviewed draft, regardless of what overrides exist.
    return { source: "none", rules: [], additionalProhibitedItems: [], docSources: [] };
  }

  const applicable = (overrides || []).filter(
    (o) => o.venueID === venueID && (o.eventID === eventID || o.eventID == null) && o.status !== "unavailable"
  );

  const officialOverrides = applicable
    .filter((o) => o.authority !== "communityReport")
    .sort((a, b) => AUTHORITY_RANK[b.authority] - AUTHORITY_RANK[a.authority]); // lowest authority first, so higher authority applies (and wins) last

  const communityOverrides = applicable.filter((o) => o.authority === "communityReport");

  // 1. Start from the curated base venue policy rules.
  const ruleMap = new Map();
  (venuePolicy.rules || []).forEach((r) => ruleMap.set(ruleKey(r), r));

  // 2. Official overrides win over matching base rules — applied lowest
  //    authority to highest, so the highest-authority version is what
  //    remains in the map for any given key.
  officialOverrides.forEach((o) => (o.rules || []).forEach((r) => ruleMap.set(ruleKey(r), r)));

  // 3. Community reports fill gaps only — never overwrite a key that's
  //    already answered by the base policy or an official override.
  communityOverrides.forEach((o) =>
    (o.rules || []).forEach((r) => {
      const key = ruleKey(r);
      if (!ruleMap.has(key)) ruleMap.set(key, r);
    })
  );

  const additionalProhibitedItems = [...new Set(applicable.flatMap((o) => o.additionalProhibitedItems || []))];
  const docSources = [venuePolicy.source, ...applicable.map((o) => o.source)].filter(Boolean);

  return {
    source: "merged",
    rules: Array.from(ruleMap.values()),
    additionalProhibitedItems,
    docSources,
  };
}

/**
 * "Unknown stays unknown" for transportation: only verified headline text,
 * verified routes, and verified facts reach the UI. Deep links (map URLs)
 * aren't factual claims needing verification, so they always pass through.
 */
export function filterTransportationForDisplay(transportation) {
  if (!transportation) return null;
  return {
    headline: transportation.headline && transportation.headline.verified ? transportation.headline : null,
    deepLinks: transportation.deepLinks || null,
    origins: (transportation.origins || [])
      .map((o) => ({ ...o, routes: (o.routes || []).filter((r) => r.verified) }))
      .filter((o) => o.routes.length > 0),
    modes: (transportation.modes || [])
      .map((m) => ({ ...m, facts: (m.facts || []).filter((f) => f.verified) }))
      .filter((m) => m.facts.length > 0 || (m.summaryItems && m.summaryItems.length > 0)),
  };
}
