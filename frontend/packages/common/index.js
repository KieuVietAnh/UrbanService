// packages/common/index.js
// Shared logic and utilities for both Web and Mobile apps

export const APP_NAME = "UrbanMind";

export const formatTicketId = (fbId) => {
  if (!fbId) return '';
  const num = fbId.split('-').pop();
  return `UM-2026-00${num}`;
};

// Add shared configurations, validation schema, or API endpoint constants here
