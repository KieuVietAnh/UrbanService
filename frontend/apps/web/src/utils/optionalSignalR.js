/**
 * Build an optional realtime connection without letting SignalR write handled
 * negotiation failures to console.error. Every caller keeps an HTTP/REST path
 * as the source of truth and handles connection failure explicitly.
 */
export const createOptionalSignalRConnection = ({
  signalR,
  hubUrl,
  accessTokenFactory,
}) => (
  new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, { accessTokenFactory })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.None)
    .build()
);
