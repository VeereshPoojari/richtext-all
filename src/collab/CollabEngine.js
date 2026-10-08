import { escapeHtml } from '../utils/security.js';

export class CollabEngine {
  constructor(editor, options = {}) {
    this.editor = editor;
    this.options = {
      serverUrl: null, // e.g. 'ws://localhost:1234'
      roomId: 'default-doc-room',
      user: {
        id: `usr-${Math.random().toString(36).substr(2, 6)}`,
        name: 'You (Author)',
        color: this.getRandomColor()
      },
      ...options
    };

    this.socket = null;
    this.peers = new Map(); // id -> { name, color, cursorEl, lastActive }
    this.localTooltipEl = null;
    this.localTooltipTimer = null;
  }

  mount(containerEl) {
    this.containerEl = containerEl;
    this.bindEditorEvents();

    if (this.options.serverUrl) {
      this.connectWebSocket();
    }
  }

  setUser(user) {
    if (!user) return;
    this.options.user = user;
    if (this.localTooltipEl) {
      this.localTooltipEl.style.backgroundColor = user.color || '#6366f1';
      this.localTooltipEl.style.borderTopColor = user.color || '#6366f1';
      this.localTooltipEl.textContent = user.name || 'You';
    }
  }

  setPeerPresence(userId, data) {
    this.peers.set(userId, { ...data, lastActive: Date.now() });
  }

  updatePresenceUI() {
    // Presence bar under toolbar has been removed
  }

  removePeerPresence(userId) {
    const peer = this.peers.get(userId);
    if (peer && peer.cursorEl) {
      peer.cursorEl.remove();
    }
    this.peers.delete(userId);
  }

  getCaretCoordinates() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);

    const rects = range.getClientRects();
    if (rects.length > 0 && (rects[0].width > 0 || rects[0].height > 0)) {
      const r = rects[0];
      return { x: r.left, y: r.top, height: r.height };
    }

    const rect = range.getBoundingClientRect();
    if (rect && (rect.width > 0 || rect.height > 0)) {
      return { x: rect.left, y: rect.top, height: rect.height };
    }

    // Fallback: check active node/line in editor
    let node = range.startContainer;
    if (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }
      if (node && node.getBoundingClientRect) {
        const nr = node.getBoundingClientRect();
        return { x: nr.left, y: nr.top, height: nr.height || 20 };
      }
    }
    return null;
  }

  /**
   * Displays the clean user name tooltip right where the cursor blinks / clicks
   */
  showLocalCursorTooltip() {
    const coords = this.getCaretCoordinates();
    if (!coords) return;

    if (!this.localTooltipEl) {
      this.localTooltipEl = document.createElement('div');
      this.localTooltipEl.className = 'rta-user-typing-tooltip';
      document.body.appendChild(this.localTooltipEl);
    }

    const user = this.options.user || { name: 'You (Author)', color: '#6366f1' };
    this.localTooltipEl.style.backgroundColor = user.color;
    this.localTooltipEl.style.borderTopColor = user.color;
    
    // Displays ONLY the user's name
    this.localTooltipEl.textContent = user.name;

    const top = window.scrollY + coords.y - 25;
    const left = window.scrollX + coords.x;

    this.localTooltipEl.style.top = `${Math.max(10, top)}px`;
    this.localTooltipEl.style.left = `${left}px`;
    this.localTooltipEl.classList.add('is-active');

    clearTimeout(this.localTooltipTimer);
    this.localTooltipTimer = setTimeout(() => {
      if (this.localTooltipEl) {
        this.localTooltipEl.classList.remove('is-active');
      }
    }, 2500);
  }

  bindEditorEvents() {
    // 1. Show tooltip on edit change
    this.editor.on('change', () => {
      this.showLocalCursorTooltip();
      const coords = this.getCaretCoordinates();
      this.broadcast('edit', { content: this.editor.getHTML(), user: this.options.user });
      if (coords) {
        this.broadcast('cursor', { x: coords.x, y: coords.y, user: this.options.user });
      }
    });

    if (this.containerEl) {
      // 2. On Click or Mouseup anywhere in editor -> show tooltip where cursor blinks
      this.containerEl.addEventListener('click', () => {
        setTimeout(() => this.showLocalCursorTooltip(), 10);
      });
      this.containerEl.addEventListener('mouseup', () => {
        setTimeout(() => this.showLocalCursorTooltip(), 10);
      });
      this.containerEl.addEventListener('focusin', () => {
        setTimeout(() => this.showLocalCursorTooltip(), 10);
      });

      // 3. On Typing (input, keydown, keyup) -> follow blinking cursor
      this.containerEl.addEventListener('input', () => {
        this.showLocalCursorTooltip();
      });
      this.containerEl.addEventListener('keydown', () => {
        setTimeout(() => this.showLocalCursorTooltip(), 5);
      });
      this.containerEl.addEventListener('keyup', () => {
        this.showLocalCursorTooltip();
      });
    }

    // 4. On Selection change (clicking or arrow keys) -> show tooltip where cursor blinks
    document.addEventListener('selectionchange', () => {
      if (this.editor.isEditorFocused()) {
        this.showLocalCursorTooltip();
        const coords = this.getCaretCoordinates();
        if (coords) {
          this.broadcast('cursor', {
            x: coords.x,
            y: coords.y,
            user: this.options.user
          });
        }
      }
    });
  }

  /**
   * Renders a remote peer's live colored cursor with their clean name tooltip
   */
  updateRemoteCursor(user, coords) {
    if (!user || user.id === this.options.user.id) return;

    let peer = this.peers.get(user.id);
    if (!peer) {
      peer = { id: user.id, name: user.name, color: user.color };
      this.peers.set(user.id, peer);
    }

    if (!peer.cursorEl) {
      peer.cursorEl = document.createElement('div');
      peer.cursorEl.className = 'rta-remote-cursor';
      document.body.appendChild(peer.cursorEl);
    }

    const peerColor = user.color || peer.color || '#ec4899';
    peer.cursorEl.style.borderLeftColor = peerColor;
    
    // Displays ONLY the user's name
    peer.cursorEl.innerHTML = `
      <span class="rta-cursor-tag" style="background-color: ${peerColor}; border-top-color: ${peerColor};">
        ${escapeHtml(user.name || peer.name)}
      </span>
    `;

    const posX = coords.left !== undefined ? coords.left : (coords.x || 100);
    const posY = coords.top !== undefined ? coords.top : (coords.y || 100);

    peer.cursorEl.style.top = `${window.scrollY + posY}px`;
    peer.cursorEl.style.left = `${window.scrollX + posX}px`;
    peer.cursorEl.style.display = 'block';

    clearTimeout(peer.cursorTimer);
    peer.cursorTimer = setTimeout(() => {
      if (peer.cursorEl) peer.cursorEl.style.display = 'none';
    }, 3500);
  }

  renderRemoteCursor(peerId, coords) {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.updateRemoteCursor(peer, coords);
    }
  }

  connectWebSocket() {
    try {
      this.socket = new WebSocket(this.options.serverUrl);
      this.socket.onopen = () => {
        this.broadcast('join', { user: this.options.user, roomId: this.options.roomId });
      };
      this.socket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'cursor') {
          this.updateRemoteCursor(data.user, data.coords);
        } else if (data.type === 'edit') {
          // Sync remote edit
          this.editor.setHTML(data.content);
          if (data.user) {
            this.updateRemoteCursor(data.user, data.coords || { x: 200, y: 300 });
          }
        } else if (data.type === 'peer_join') {
          this.setPeerPresence(data.user.id, data.user);
        } else if (data.type === 'peer_leave') {
          this.removePeerPresence(data.user.id);
        }
      };
    } catch {
      // Offline fallback
    }
  }

  broadcast(type, payload) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, roomId: this.options.roomId, ...payload }));
    }
  }

  getRandomColor() {
    const palette = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  destroy() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.peers.forEach(p => {
      if (p.cursorEl) p.cursorEl.remove();
    });
    this.peers.clear();
    if (this.localTooltipEl) {
      this.localTooltipEl.remove();
      this.localTooltipEl = null;
    }
  }
}
