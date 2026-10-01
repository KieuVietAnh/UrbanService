import assert from 'node:assert/strict';
import test from 'node:test';
import { createOptionalSignalRConnection } from './optionalSignalR.js';

test('optional SignalR connections suppress handled transport errors', () => {
  const calls = [];
  const connection = { kind: 'connection' };

  class HubConnectionBuilder {
    withUrl(url, options) {
      calls.push(['withUrl', url, options]);
      return this;
    }

    withAutomaticReconnect() {
      calls.push(['withAutomaticReconnect']);
      return this;
    }

    configureLogging(level) {
      calls.push(['configureLogging', level]);
      return this;
    }

    build() {
      calls.push(['build']);
      return connection;
    }
  }

  const signalR = {
    HubConnectionBuilder,
    LogLevel: { None: 'none' },
  };
  const accessTokenFactory = () => 'token';

  const result = createOptionalSignalRConnection({
    signalR,
    hubUrl: 'https://api.example.test/hubs/notifications',
    accessTokenFactory,
  });

  assert.equal(result, connection);
  assert.deepEqual(calls, [
    ['withUrl', 'https://api.example.test/hubs/notifications', { accessTokenFactory }],
    ['withAutomaticReconnect'],
    ['configureLogging', 'none'],
    ['build'],
  ]);
});
