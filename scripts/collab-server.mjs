/**
 * scripts/collab-server.mjs - Zero-Dependency WebSocket Collaboration Relay Server
 * Fully implements RFC 6455 WebSocket protocol using Node.js built-in 'http' and 'crypto'.
 * Run with: node scripts/collab-server.mjs [port]
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const PORT = parseInt(process.argv[2] || process.env.PORT || '1234', 10);
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// roomId -> Set of client sockets
const rooms = new Map();
let clientCounter = 0;

function encodeWsFrame(data) {
  const payload = Buffer.from(data, 'utf8');
  const length = payload.length;

  let header;
  if (length <= 125) {
    header = Buffer.from([0x81, length]);
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

function decodeWsFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];

    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;

    let headerLength = 2;
    if (payloadLength === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      if (offset + 10 > buffer.length) break;
      payloadLength = Number(buffer.readBigUInt64BE(offset + 2));
      headerLength = 10;
    }

    const maskKeyLength = isMasked ? 4 : 0;
    const totalFrameLength = headerLength + maskKeyLength + payloadLength;

    if (offset + totalFrameLength > buffer.length) {
      break; // Need more chunks
    }

    let payload;
    if (isMasked) {
      const maskKey = buffer.slice(offset + headerLength, offset + headerLength + 4);
      const rawPayload = buffer.slice(offset + headerLength + 4, offset + totalFrameLength);
      payload = Buffer.alloc(payloadLength);
      for (let i = 0; i < payloadLength; i++) {
        payload[i] = rawPayload[i] ^ maskKey[i % 4];
      }
    } else {
      payload = buffer.slice(offset + headerLength, offset + totalFrameLength);
    }

    frames.push({ opcode, payload });
    offset += totalFrameLength;
  }

  return { frames, remainder: buffer.slice(offset) };
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // Route 1: Serve full demo playground
  if (urlPath === '/' || urlPath === '/playground' || urlPath === '/playground/' || urlPath === '/playground/index.html' || urlPath === '/playground.html') {
    let filePath = path.join(rootDir, 'playground', 'index.html');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(rootDir, 'playground.html');
    }
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  // Route 2: Status endpoint
  if (urlPath === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      service: 'richtext-all-collab-server',
      status: 'online',
      port: PORT,
      activeRooms: rooms.size,
      timestamp: new Date().toISOString()
    }));
  }

  // Route 3: Serve static files (src/, styles, etc.)
  const safePath = path.normalize(path.join(rootDir, urlPath));
  if (safePath.startsWith(rootDir) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    const ext = path.extname(safePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    return fs.createReadStream(safePath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash('sha1')
    .update(key + WS_GUID)
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`
  ];

  socket.write(headers.join('\r\n') + '\r\n\r\n');

  const clientId = `client-${++clientCounter}`;
  let currentRoomId = 'default-doc-room';
  let buffer = Buffer.alloc(0);

  const joinRoom = (roomId) => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      rooms.get(currentRoomId).delete(socket);
    }
    currentRoomId = roomId || 'default-doc-room';
    if (!rooms.has(currentRoomId)) {
      rooms.set(currentRoomId, new Set());
    }
    rooms.get(currentRoomId).add(socket);
  };

  joinRoom(currentRoomId);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const { frames, remainder } = decodeWsFrames(buffer);
    buffer = remainder;

    for (const frame of frames) {
      if (frame.opcode === 0x8) {
        // Connection close
        socket.destroy();
        return;
      }
      if (frame.opcode === 0x9) {
        // Ping -> Pong
        const pong = Buffer.from([0x8a, 0x00]);
        socket.write(pong);
        continue;
      }
      if (frame.opcode === 0x1) {
        // Text message
        try {
          const raw = frame.payload.toString('utf8');
          const data = JSON.parse(raw);
          if (data.roomId && data.roomId !== currentRoomId) {
            joinRoom(data.roomId);
          }

          // Broadcast to all other peers in the room
          const roomSockets = rooms.get(currentRoomId);
          if (roomSockets) {
            const outgoingFrame = encodeWsFrame(raw);
            roomSockets.forEach((client) => {
              if (client !== socket && client.writable) {
                try {
                  client.write(outgoingFrame);
                } catch {
                  roomSockets.delete(client);
                }
              }
            });
          }
        } catch (err) {
          // Ignore malformed JSON
        }
      }
    }
  });

  const cleanup = () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      rooms.get(currentRoomId).delete(socket);
      if (rooms.get(currentRoomId).size === 0) {
        rooms.delete(currentRoomId);
      }
    }
  };

  socket.on('close', cleanup);
  socket.on('error', cleanup);
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 richtext-all Real-Time Collaboration Server Running!`);
  console.log(`📡 WebSocket URL:    ws://localhost:${PORT}`);
  console.log(`🌐 Local Playground: http://localhost:${PORT}`);
  console.log(`💡 Zero runtime dependencies (Pure Node.js standard library)`);
  console.log(`======================================================\n`);
});
