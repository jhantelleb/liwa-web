// Firebase web config — PRODUCTION project (liwa-211a3).
// This is a client-side config key, safe to be public (it identifies the
// project, it does not authorize access — Firestore security rules do that).
//
// Swapped from staging on the same day the security rules + composite
// index were set up on staging. Before this actually goes live in a push,
// make sure production has: (1) the same firestore.rules published,
// (2) the same composite index on eventPolicyOverrides (venueID, eventID,
// status), and (3) verified trustStatus/status values on existing venue
// policy docs — otherwise the site will hit the same permission-denied /
// missing-index errors staging just went through.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCnMTNPWbYFJYLvGksMokhb9WSjKwfgFXM",
  authDomain: "liwa-211a3.firebaseapp.com",
  projectId: "liwa-211a3",
  storageBucket: "liwa-211a3.firebasestorage.app",
  messagingSenderId: "868463016313",
  appId: "1:868463016313:web:ede0b7ffc670420b7697a8",
  measurementId: "G-GV3ESS5VVC",
};
