// Dev-only re-export for in-memory mock DB.
// Import this explicitly from applications during development only, e.g.
// if (import.meta.env.VITE_USE_MOCK === 'true') {
//   const { mockDb } = await import('@urbanmind/shared-api/src/dev/mockIndex.js');
// }

export { mockDb } from '../mockStore.js';
