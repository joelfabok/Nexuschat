import { io } from 'socket.io-client';

let socket = null;
const listeners = new Set(); // callbacks to call when socket becomes available

export const connectSocket = (accessToken) => {
  if (socket?.connected) return socket;
  if (socket) { socket.disconnect(); socket = null; }

  // On localhost: connect directly to port 3001
  // On a tunnel/HTTPS (phone testing): backend is on a separate tunnel URL stored in env,
  // or fall back to same host with no port (works if you proxy /socket.io through vite)
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const serverUrl = isLocal
    ? `http://localhost:3001`
    : (import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3001`);

  socket = io(serverUrl, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected');
    // Notify any listeners waiting for socket
    listeners.forEach(cb => cb(socket));
    listeners.clear();
  });
  socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
  socket.on('connect_error', (err) => console.error('🔌 Socket error:', err.message));

  return socket;
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};

export const getSocket = () => socket;

// Returns a promise that resolves with the socket once connected
// Useful for effects that run before socket is ready
export const waitForSocket = () => {
  if (socket?.connected) return Promise.resolve(socket);
  return new Promise(resolve => listeners.add(resolve));
};
