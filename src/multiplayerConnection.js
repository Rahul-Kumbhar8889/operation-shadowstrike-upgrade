import { io } from 'socket.io-client';

export function createLobbyConnection({ serverUrl, onStatus = () => {}, connectTimeout = 90000, ackTimeout = 10000 } = {}) {
  // Polling first allows networks without WebSocket support to connect, then upgrade.
  const socket = io(serverUrl || undefined, {
    autoConnect: false,
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    timeout: connectTimeout,
    reconnection: false,
  });
  let pending = null;
  let cancelPending = null;

  function cancel() {
    cancelPending?.();
    socket.disconnect();
  }

  async function request(eventName, code) {
    if (pending) throw new Error('A room request is already in progress.');
    if (serverUrl) {
      let url;
      try { url = new URL(serverUrl); } catch {
        throw new Error('Invalid multiplayer server URL. Set VITE_SOCKET_SERVER_URL to the public HTTPS server URL and rebuild.');
      }
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Multiplayer server URL must use HTTP or HTTPS.');
      if (globalThis.location?.protocol === 'https:' && url.protocol !== 'https:') {
        throw new Error('This HTTPS game requires an HTTPS multiplayer server. Update VITE_SOCKET_SERVER_URL and rebuild.');
      }
    }
    onStatus('Connecting to multiplayer server… A sleeping server can take up to 90 seconds.');
    pending = new Promise((resolve, reject) => {
      let timer;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        socket.off('connect', connected);
        socket.off('connect_error', failed);
        socket.off('disconnect', disconnected);
        cancelPending = null;
      };
      const finish = (error, response) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) { socket.disconnect(); reject(error); }
        else resolve(response);
      };
      const failed = (error) => finish(new Error(
        `Connection failed: ${error.message}. Check the public server /health endpoint, HTTPS, and CORS_ORIGINS. Both players must use the same server. If it is sleeping, wait and retry.`
      ));
      const disconnected = (reason) => finish(new Error(`Connection lost (${reason}). Retry creating or joining the room.`));
      const connected = () => {
        clearTimeout(timer);
        socket.off('connect', connected);
        onStatus(eventName === 'join-room' ? 'Connected. Joining room…' : 'Connected. Creating room…');
        const args = ['join-room','create-coop'].includes(eventName) ? [code] : [];
        socket.timeout(ackTimeout).emit(eventName, ...args, (error, response) => {
          if (error) return finish(new Error('The server did not acknowledge the room request. Retry; verify both players use the same running server.'));
          if (!response?.ok) return finish(new Error(response?.error || 'Unable to join room.'));
          finish(null, response);
        });
      };
      cancelPending = () => finish(null, null);
      socket.on('disconnect', disconnected);
      socket.once('connect_error', failed);
      if (socket.connected) connected();
      else {
        socket.once('connect', connected);
        timer = setTimeout(() => failed(new Error('connection timed out')), connectTimeout);
        socket.connect();
      }
    });
    try { return await pending; } finally { pending = null; }
  }

  return { socket, request, cancel };
}
