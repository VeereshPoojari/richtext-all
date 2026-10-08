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
    this.channel = null;
    this.peers = new Map(); // id -> { name, color, cursorEl, lastActive }
    this.localTooltipEl = null;
    this.localTooltipTimer = null;
    this.isRemoteApplying = false;
  }

  mount(containerEl) {
    this.containerEl = containerEl;
    this.bindEditorEvents();

    // 1. Cross-tab & multi-window peer-to-peer sync via BroadcastChannel (zero-config, no server needed)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channelName = `rta-collab-${this.options.roomId || 'default'}`;
        this.channel = new BroadcastChannel(channelName);
        this.channel.onmessage = (e) => {
          this.handleIncomingMessage(e.data);
        };
      } catch {
        // Fallback gracefully if BroadcastChannel fails
      }
    }

    // 2. Cross-browser & cross-device sync via WebSocket (when serverUrl provided)
    if (this.options.serverUrl) {
      this.connectWebSocket();
    }

    // 3. Announce arrival to existing peers with current cursor position
    setTimeout(() => {
      const coords = this.getCaretCoordinates();
      this.broadcast('join', { user: this.options.user, coords });
    }, 150);

    // 4. Announce leave on window close
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.broadcast('peer_leave', { user: this.options.user });
      });

      // 5. Keep all cursor tooltips locked to exact positions on resize and scroll
      window.addEventListener('resize', () => this.repositionAllCursors());
      window.addEventListener('scroll', () => this.repositionAllCursors(), { passive: true });
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
    if (typeof window === 'undefined') return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);

    let rect = null;

    // 1. High-precision character range probe (non-destructive, zero DOM mutation)
    // When caret is inside or at boundary of a TextNode, probing 1 character guarantees
    // the browser returns the exact pixel-level bounding rect of the caret position.
    if (range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.startContainer;
      const textLen = textNode.textContent ? textNode.textContent.length : 0;
      const offset = range.startOffset;

      if (textLen > 0) {
        try {
          const charRange = document.createRange();
          if (offset < textLen) {
            charRange.setStart(textNode, offset);
            charRange.setEnd(textNode, offset + 1);
            const cr = charRange.getBoundingClientRect();
            if (cr && (cr.width > 0 || cr.height > 0 || cr.top > 0 || cr.left > 0)) {
              rect = { left: cr.left, top: cr.top, height: cr.height || 20 };
            }
          } else if (offset > 0) {
            charRange.setStart(textNode, offset - 1);
            charRange.setEnd(textNode, offset);
            const cr = charRange.getBoundingClientRect();
            if (cr && (cr.width > 0 || cr.height > 0 || cr.top > 0 || cr.left > 0)) {
              rect = { left: cr.right, top: cr.top, height: cr.height || 20 };
            }
          }
        } catch {}
      }
    }

    // 2. Try standard getClientRects() if character probe wasn't applicable
    if (!rect) {
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (r.width > 0 || r.height > 0 || r.top > 0 || r.left > 0) {
          rect = { left: r.left, top: r.top, height: r.height || 20 };
          break;
        }
      }
    }

    // 3. Try range.getBoundingClientRect()
    if (!rect) {
      const b = range.getBoundingClientRect();
      if (b && (b.top > 0 || b.left > 0)) {
        rect = { left: b.left, top: b.top, height: b.height || 20 };
      }
    }

    // 4. Element boundary & empty line fallback (<p><br></p>, etc.)
    if (!rect) {
      let node = range.startContainer;
      if (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentElement;
        }
        if (node && node.nodeType === Node.ELEMENT_NODE) {
          const child = node.childNodes[range.startOffset] || node.firstElementChild;
          if (child && child.nodeType === Node.ELEMENT_NODE && child.getBoundingClientRect) {
            const cr = child.getBoundingClientRect();
            if (cr.top > 0 || cr.left > 0) {
              rect = { left: cr.left, top: cr.top, height: cr.height || 20 };
            }
          }
          if (!rect && node.getBoundingClientRect) {
            const nr = node.getBoundingClientRect();
            let padLeft = 0;
            let padTop = 0;
            if (typeof window !== 'undefined' && window.getComputedStyle) {
              const cs = window.getComputedStyle(node);
              padLeft = parseFloat(cs.paddingLeft) || 0;
              padTop = parseFloat(cs.paddingTop) || 0;
            }
            rect = { left: nr.left + padLeft, top: nr.top + padTop, height: 20 };
          }
        }
      }
    }

    if (!rect) return null;

    // 5. Measure page-relative coordinates so positioning is 100% identical across any browser screen size / zoom
    let pageEl = range.startContainer;
    while (pageEl && !pageEl.classList?.contains('rta-page-sheet')) {
      pageEl = pageEl.parentElement;
    }

    if (pageEl) {
      const pageNum = parseInt(pageEl.getAttribute('data-page-number') || '1', 10);
      const pageRect = pageEl.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        height: rect.height || 20,
        pageNumber: pageNum,
        relX: rect.left - pageRect.left,
        relY: rect.top - pageRect.top
      };
    }

    return {
      x: rect.left,
      y: rect.top,
      height: rect.height || 20,
      pageNumber: 1,
      relX: rect.left,
      relY: rect.top
    };
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
    this.localTooltipEl.style.backgroundColor = user.color || '#6366f1';
    this.localTooltipEl.style.borderTopColor = user.color || '#6366f1';
    this.localTooltipEl.textContent = user.name || 'You';

    // Position directly above the exact blinking caret position:
    const top = window.scrollY + coords.y - 24;
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
    // 1. Show tooltip on edit change and broadcast
    this.editor.on('change', () => {
      this.showLocalCursorTooltip();
      if (this.isRemoteApplying) return; // Prevent echo loop!

      const coords = this.getCaretCoordinates();
      this.broadcast('edit', {
        content: this.editor.getHTML(),
        user: this.options.user,
        coords
      });
      if (coords) {
        this.broadcast('cursor', {
          coords,
          user: this.options.user
        });
      }
    });

    if (this.containerEl) {
      // 2. On Click or Mouseup anywhere in editor -> show tooltip where cursor blinks
      this.containerEl.addEventListener('click', () => {
        setTimeout(() => {
          this.showLocalCursorTooltip();
          const coords = this.getCaretCoordinates();
          if (coords) {
            this.broadcast('cursor', { coords, user: this.options.user });
          }
        }, 15);
      });
      this.containerEl.addEventListener('mouseup', () => {
        setTimeout(() => {
          this.showLocalCursorTooltip();
          const coords = this.getCaretCoordinates();
          if (coords) {
            this.broadcast('cursor', { coords, user: this.options.user });
          }
        }, 15);
      });
      this.containerEl.addEventListener('focusin', () => {
        setTimeout(() => this.showLocalCursorTooltip(), 15);
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
        const coords = this.getCaretCoordinates();
        if (coords) {
          this.broadcast('cursor', { coords, user: this.options.user });
        }
      });
    }

    // 4. On Selection change (clicking or arrow keys) -> show tooltip where cursor blinks
    document.addEventListener('selectionchange', () => {
      if (this.editor.isEditorFocused?.()) {
        this.showLocalCursorTooltip();
        const coords = this.getCaretCoordinates();
        if (coords) {
          this.broadcast('cursor', {
            coords,
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
    if (!user || user.id === this.options.user?.id) return;
    if (!coords) return;

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
    peer.cursorEl.innerHTML = `
      <span class="rta-cursor-tag" style="background-color: ${peerColor}; border-top-color: ${peerColor};">
        ${escapeHtml(user.name || peer.name)}
      </span>
    `;

    // Compute pixel-perfect coordinates on receiver's viewport:
    let finalX = 0;
    let finalY = 0;

    if (coords.pageNumber && coords.relX !== undefined && coords.relY !== undefined) {
      const pageEl = document.querySelector(`.rta-page-sheet[data-page-number="${coords.pageNumber}"]`) ||
                     document.querySelector('.rta-page-sheet');
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        finalX = window.scrollX + pageRect.left + coords.relX;
        finalY = window.scrollY + pageRect.top + coords.relY;
      } else {
        finalX = window.scrollX + (coords.x || 100);
        finalY = window.scrollY + (coords.y || 100);
      }
    } else {
      finalX = window.scrollX + (coords.x || coords.left || 100);
      finalY = window.scrollY + (coords.y || coords.top || 100);
    }

    const cursorH = coords.height || 20;
    peer.cursorEl.style.height = `${cursorH}px`;
    peer.cursorEl.style.top = `${finalY}px`;
    peer.cursorEl.style.left = `${finalX}px`;
    peer.cursorEl.style.display = 'block';

    peer.lastCoords = coords;
    peer.lastUser = user;
    // Cursor pointer remains visible continuously until peer leaves/disconnects
  }

  repositionAllCursors() {
    this.peers.forEach(peer => {
      if (peer.lastCoords && peer.cursorEl) {
        this.updateRemoteCursor(peer.lastUser || peer, peer.lastCoords);
      }
    });
    if (this.localTooltipEl && this.localTooltipEl.classList.contains('is-active')) {
      const coords = this.getCaretCoordinates();
      if (coords) {
        const top = window.scrollY + coords.y - 24;
        const left = window.scrollX + coords.x;
        this.localTooltipEl.style.top = `${Math.max(10, top)}px`;
        this.localTooltipEl.style.left = `${Math.max(10, left)}px`;
      }
    }
  }

  renderRemoteCursor(peerId, coords) {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.updateRemoteCursor(peer, coords);
    }
  }

  applyRemoteEdit(newContent, user, coords) {
    if (typeof newContent !== 'string') return;
    const current = this.editor.getHTML();
    if (current === newContent) return;

    this.isRemoteApplying = true;
    try {
      this.editor.setHTML(newContent);
      if (user && coords) {
        this.updateRemoteCursor(user, coords);
      }
    } finally {
      setTimeout(() => {
        this.isRemoteApplying = false;
      }, 50);
    }
  }

  handleIncomingMessage(data) {
    if (!data || data.senderId === this.options.user?.id) return;
    if (data.roomId && this.options.roomId && data.roomId !== this.options.roomId) return;

    if (data.type === 'cursor') {
      this.updateRemoteCursor(data.user, data.coords || { x: data.x, y: data.y });
    } else if (data.type === 'edit') {
      this.applyRemoteEdit(data.content, data.user, data.coords);
    } else if (data.type === 'join' || data.type === 'peer_join') {
      if (data.user) {
        this.setPeerPresence(data.user.id, data.user);
        if (data.coords) {
          this.updateRemoteCursor(data.user, data.coords);
        }
        // Reply with current document content AND our cursor position so newly joined peer sees us immediately!
        const currentContent = this.editor.getHTML();
        const myCoords = this.getCaretCoordinates();
        if (currentContent && currentContent.trim()) {
          this.broadcast('sync_state', {
            content: currentContent,
            user: this.options.user,
            coords: myCoords,
            targetId: data.user.id
          });
        }
      }
    } else if (data.type === 'sync_state') {
      // Sync initial document content from existing peer
      if (!data.targetId || data.targetId === this.options.user?.id) {
        this.applyRemoteEdit(data.content, data.user, null);
        if (data.user && data.coords) {
          this.updateRemoteCursor(data.user, data.coords);
        }
      }
    } else if (data.type === 'peer_leave') {
      if (data.user) {
        this.removePeerPresence(data.user.id);
      }
    }
  }

  connectWebSocket() {
    try {
      this.socket = new WebSocket(this.options.serverUrl);
      this.socket.onopen = () => {
        const coords = this.getCaretCoordinates();
        this.broadcast('join', { user: this.options.user, roomId: this.options.roomId, coords });
      };
      this.socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          this.handleIncomingMessage(data);
        } catch {}
      };
      this.socket.onclose = () => {
        // Auto-reconnect after 3s only if not manually disconnected
        if (!this.isManuallyDisconnected && this.options.serverUrl) {
          setTimeout(() => {
            if (this.options.serverUrl && !this.socket && !this.isManuallyDisconnected) {
              this.connectWebSocket();
            }
          }, 3000);
        }
      };
    } catch {
      // Offline fallback
    }
  }

  broadcast(type, payload) {
    const message = {
      type,
      roomId: this.options.roomId,
      senderId: this.options.user?.id,
      ...payload
    };

    // 1. BroadcastChannel (local tabs & windows on same origin)
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch {}
    }

    // 2. WebSocket (network peers across different browsers/devices)
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
      } catch {}
    }
  }

  getRandomColor() {
    const palette = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  /**
   * Explicitly disconnects from the room, announces exit to peers, and removes all cursors
   */
  disconnect() {
    this.isManuallyDisconnected = true;

    // 1. Announce exit to other collaborators so they immediately remove our cursor
    try {
      this.broadcast('peer_leave', { user: this.options.user });
    } catch {}

    // 2. Close active WebSocket
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }

    // 3. Close BroadcastChannel
    if (this.channel) {
      try {
        this.channel.close();
      } catch {}
      this.channel = null;
    }

    // 4. Remove all peer cursors from local editor view
    this.peers.forEach(p => {
      if (p.cursorEl) p.cursorEl.remove();
    });
    this.peers.clear();

    // 5. Hide local tooltip
    if (this.localTooltipEl) {
      this.localTooltipEl.classList.remove('is-active');
    }

    this.isConnected = false;
    this.editor.emit('collabDisconnected', { user: this.options.user });
  }

  /**
   * Reconnects to collaboration room and announces presence
   */
  connect(serverUrl = this.options.serverUrl) {
    this.isManuallyDisconnected = false;
    if (serverUrl !== undefined) {
      this.options.serverUrl = serverUrl;
    }

    // 1. Re-open BroadcastChannel if supported
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window && !this.channel) {
      try {
        const channelName = `rta-collab-${this.options.roomId || 'default'}`;
        this.channel = new BroadcastChannel(channelName);
        this.channel.onmessage = (e) => this.handleIncomingMessage(e.data);
      } catch {}
    }

    // 2. Re-open WebSocket if serverUrl configured
    if (this.options.serverUrl) {
      this.connectWebSocket();
    }

    // 3. Announce arrival to peers
    setTimeout(() => {
      const coords = this.getCaretCoordinates();
      this.broadcast('join', { user: this.options.user, coords });
    }, 150);

    this.isConnected = true;
    this.editor.emit('collabConnected', { user: this.options.user, serverUrl: this.options.serverUrl });
  }

  destroy() {
    this.disconnect();
    if (this.localTooltipEl) {
      this.localTooltipEl.remove();
      this.localTooltipEl = null;
    }
  }
}
