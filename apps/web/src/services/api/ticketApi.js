import { ticketApi as sharedTicketApi } from '@urbanmind/shared-api';

// Re-export the shared API to centralize logic. Keep this thin wrapper
// to allow app-specific extensions in future without duplication.
export const ticketApi = sharedTicketApi;
