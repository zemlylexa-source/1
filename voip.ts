import Peer, { MediaConnection } from 'peerjs';

let peer: Peer | null = null;
let currentCall: MediaConnection | null = null;

export function initVoip(userId: string, onIncoming: (call: MediaConnection) => void) {
  if (peer) return peer;
  const safeId = `zentora-${String(userId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  peer = new Peer(safeId, { debug: 0 });
  peer.on('call', (call) => {
    currentCall = call;
    onIncoming(call);
  });
  peer.on('error', (err) => console.warn('Zentora VoIP:', err.message));
  return peer;
}

export function getPeer() {
  return peer;
}

export function dialVoip(userId: string, stream: MediaStream) {
  if (!peer) throw new Error('VoIP is not initialized');
  currentCall = peer.call(`zentora-${String(userId).replace(/[^a-zA-Z0-9_-]/g, '_')}`, stream);
  return currentCall;
}

export function setCurrentCall(call: MediaConnection | null) {
  currentCall = call;
}

export function getCurrentCall() {
  return currentCall;
}

export function endVoip() {
  try { currentCall?.close(); } catch {}
  currentCall = null;
}

export function destroyVoip() {
  endVoip();
  try { peer?.destroy(); } catch {}
  peer = null;
}
