/**
 * richtext-all - Universal Collaborative Rich Text & Live Editor Engine
 * Zero-dependency, framework-agnostic, live multiplayer collaboration.
 * (c) 2026 Veeresh Poojari <veeresha3993@gmail.com>
 * MIT Licensed
 */

import { EditorCore } from './core/EditorCore.js';
import { Toolbar } from './ui/Toolbar.js';
import { BubbleMenu } from './ui/BubbleMenu.js';
import { SlashCommand } from './ui/SlashCommand.js';
import { SplitView } from './modes/SplitView.js';
import { CollabEngine } from './collab/CollabEngine.js';
import { SyncAdapter } from './server/SyncAdapter.js';
import { escapeHtml, sanitizeUrl } from './utils/security.js';
import { readDocumentFile, parseDocxFile } from './utils/docxReader.js';

export class RichEditor {
  constructor(target, options = {}) {
    this.target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.target) {
      throw new Error(`[richtext-all] Target container not found: ${target}`);
    }

    this.options = {
      initialContent: '<p>Start typing or type <code>/</code> for commands...</p>',
      placeholder: 'Type something or press "/" for commands...',
      pageLayout: 'infinite', // 'infinite', 'a4', 'letter', 'legal'
      readOnly: false,
      toolbar: true,
      bubbleMenu: true,
      slashCommand: true,
      splitView: false,
      statusBar: true,
      collab: true,          // true, { serverUrl, roomId, user }, or false to disable
      sync: null,            // { endpoint, autoSave, onSave }
      onChange: null,
      onSelectionChange: null,
      ...options
    };

    this.container = null;
    this.shellEl = null;
    this.editorEl = null;
    this.statusBarEl = null;
    this.wordsCountEl = null;
    this.charsCountEl = null;

    this.core = null;
    this.toolbar = null;
    this.bubbleMenu = null;
    this.slashCommand = null;
    this.splitView = null;
    this.collab = null;
    this.sync = null;

    this.init();
  }

  init() {
    this.buildDOM();

    // 1. Initialize Core directly in the workspace shell
    this.core = new EditorCore(this.shellEl, {
      placeholder: this.options.placeholder,
      readOnly: this.options.readOnly,
      pageLayout: this.options.pageLayout,
      gutterPosition: this.options.gutterPosition,
      user: this.options.collab?.user || this.options.user,
      users: this.options.users
    });
    this.editorEl = this.core.contentArea;

    if (this.options.initialContent) {
      this.core.setHTML(this.options.initialContent);
    }

    // 2. Collab Presence & Real-Time Sync (Cross-tab & WebSocket)
    if (this.options.collab !== false) {
      const collabConfig = typeof this.options.collab === 'object' && this.options.collab !== null
        ? this.options.collab
        : {};

      this.collab = new CollabEngine(this.core, {
        roomId: 'default-doc-room',
        ...collabConfig,
        user: this.core.options.user
      });
      this.collab.mount(this.container);
      this.core.on('userChange', (user) => {
        if (this.collab) {
          this.collab.setUser(user);
        }
      });
    }

    // 3. Toolbar (optional)
    if (this.options.toolbar !== false) {
      const toolbarConfig = typeof this.options.toolbar === 'object'
        ? this.options.toolbar
        : {};

      const defaults = {
        layout: this.options.pageLayout || 'a4',
        margin: this.options.gutterPosition || 'right',
        ...this.options.toolbarDefaults,
        ...toolbarConfig.defaults
      };

      this.toolbar = new Toolbar(this.core, {
        container: this.container,
        onToggleSplit: () => this.toggleSplitView(),
        ...toolbarConfig,
        defaults
      });
      this.toolbar.mount(this.container);
    }

    // 4. Bubble Menu (optional)
    if (this.options.bubbleMenu) {
      this.bubbleMenu = new BubbleMenu(this.core);
      this.bubbleMenu.mount?.(this.container);
    }

    // 5. Slash Commands (optional)
    if (this.options.slashCommand) {
      this.slashCommand = new SlashCommand(this.core);
      this.slashCommand.mount?.(this.container);
    }

    // 6. Split View
    this.splitView = new SplitView(this.core);
    this.splitView.mount(this.container);
    if (this.options.splitView) {
      this.splitView.show();
    }

    // 7. Sync Adapter (optional)
    if (this.options.sync) {
      this.sync = new SyncAdapter(this.core, this.options.sync);
      if (this.statusBarEl) {
        this.sync.mountStatusBadge(this.statusBarEl);
      }
    }

    // 8. Event Subscriptions
    this.bindEvents();
    this.updateStats();
    setTimeout(() => this.updateStats(), 50);
    setTimeout(() => this.updateStats(), 200);
  }

  buildDOM() {
    // Prevent duplicate containers if initialized multiple times on same target
    if (this.target) {
      this.target.innerHTML = '';
    }

    this.container = document.createElement('div');
    this.container.className = 'rta-container';

    this.shellEl = document.createElement('div');
    this.shellEl.className = 'rta-editor-shell';

    this.container.appendChild(this.shellEl);

    if (this.options.statusBar) {
      this.statusBarEl = document.createElement('div');
      this.statusBarEl.className = 'rta-status-bar';
      this.statusBarEl.innerHTML = `
        <div class="rta-status-stats">
          <span>Words: <strong id="rta-stat-words">0</strong></span>
          <span>Characters: <strong id="rta-stat-chars">0</strong></span>
        </div>
      `;
      this.container.appendChild(this.statusBarEl);
      this.wordsCountEl = this.statusBarEl.querySelector('#rta-stat-words');
      this.charsCountEl = this.statusBarEl.querySelector('#rta-stat-chars');
    }

    this.target.appendChild(this.container);
  }

  bindEvents() {
    this.core.on('change', (payload) => {
      this.updateStats();
      if (typeof this.options.onChange === 'function') {
        this.options.onChange(payload, this.core.getStats());
      }
    });

    this.core.on('selectionChange', () => {
      this.updateStats();
      if (typeof this.options.onSelectionChange === 'function') {
        this.options.onSelectionChange();
      }
    });

    this.core.on('pageAdded', () => {
      this.updateStats();
    });

    this.core.on('pageRemoved', () => {
      this.updateStats();
    });

    this.core.on('toggleMode', () => {
      this.toggleSplitView();
    });

    this.core.on('save', (payload) => {
      if (this.sync) {
        this.sync.saveToServer(payload);
      }
      if (typeof this.options.onSave === 'function') {
        this.options.onSave(payload);
      }
    });
  }

  updateStats() {
    if (!this.wordsCountEl || !this.charsCountEl) return;
    const stats = this.core.getStats();
    this.wordsCountEl.textContent = String(stats.words);
    this.charsCountEl.textContent = String(stats.chars);
  }

  toggleSplitView() {
    if (this.splitView) {
      this.splitView.toggle();
    }
  }

  // Public API methods
  getHTML() {
    return this.core.getHTML();
  }

  setHTML(html) {
    this.core.setHTML(html);
  }

  getMarkdown() {
    return this.core.getMarkdown();
  }

  setMarkdown(md) {
    this.core.setMarkdown(md);
  }

  getJSON() {
    if (this.sync) {
      return this.sync.getJSON();
    }
    const sync = new SyncAdapter(this.core);
    return sync.getJSON();
  }

  getText() {
    return this.core.getText();
  }

  getStats() {
    return this.core.getStats();
  }

  setLayout(layout) {
    this.core.setPageLayout(layout);
  }

  focus() {
    this.core.focus();
  }

  blur() {
    this.core.el.blur();
  }

  on(event, fn) {
    this.core.on(event, fn);
  }

  off(event, fn) {
    this.core.off(event, fn);
  }

  setMode(mode) {
    this.core.setMode(mode);
  }

  insertPageBreak() {
    this.core.insertPageBreak();
  }

  insertTable(rows = 3, cols = 3) {
    this.core.insertTable(rows, cols);
  }

  promptInsertTable() {
    this.core.promptInsertTable();
  }

  insertLink(url, text = null) {
    this.core.insertLink(url, text);
  }

  insertImage(url, alt = null) {
    this.core.insertImage(url, alt);
  }

  saveSelection() {
    this.core.saveSelection();
  }

  restoreSelection() {
    this.core.restoreSelection();
  }

  addNewPage() {
    return this.core.addNewPage();
  }

  removePage(pageNumber) {
    return this.core.removePage(pageNumber);
  }

  toggleCommentsPanel() {
    this.core.toggleCommentsPanel();
  }

  toggleVersionHistoryModal() {
    this.core.toggleVersionHistoryModal();
  }

  toggleVersionComparisonModal() {
    this.core.toggleVersionComparisonModal();
  }

  addComment(text) {
    this.core.addComment(text);
  }

  openCommentDraft() {
    this.core.openCommentDraft();
  }

  cancelCommentDraft() {
    this.core.cancelCommentDraft();
  }

  submitCommentDraft(text) {
    this.core.submitCommentDraft(text);
  }

  resolveComment(id) {
    this.core.resolveComment(id);
  }

  deleteComment(id) {
    this.core.deleteComment(id);
  }

  acceptSuggestion(id) {
    this.core.acceptSuggestion(id);
  }

  rejectSuggestion(id) {
    this.core.rejectSuggestion(id);
  }

  getComments() {
    return this.core.comments || [];
  }

  getSuggestions() {
    return this.core.suggestions || [];
  }

  saveVersion(title) {
    return this.core.saveVersionSnapshot(title);
  }

  restoreVersion(id) {
    this.core.restoreVersion(id);
  }

  // Active Collaborator & User Management
  getUsers() {
    return this.core.getUsers();
  }

  getCurrentUser() {
    return this.core.getCurrentUser();
  }

  setUser(userOrId) {
    const user = this.core.setUser(userOrId);
    if (this.collab) {
      this.collab.setUser(user);
    }
    return user;
  }

  addUser(name, color = null) {
    const user = this.core.addUser(name, color);
    if (this.collab) {
      this.collab.setUser(user);
    }
    return user;
  }

  promptAddUser() {
    return this.core?.promptAddUser();
  }

  on(event, callback) {
    return this.core?.on(event, callback);
  }

  emit(event, payload) {
    return this.core?.emit(event, payload);
  }

  // Annotation Cards Gutter Space Management (Left or Right Margin)
  setGutterPosition(position) {
    return this.core?.setGutterPosition(position);
  }

  getGutterPosition() {
    return this.core?.getGutterPosition() || 'right';
  }

  toggleGutterPosition() {
    return this.core?.toggleGutterPosition();
  }

  // Toolbar Visibility and Controls
  showToolbar() {
    if (!this.toolbar) {
      this.toolbar = new Toolbar(this.core, {
        container: this.container,
        onToggleSplit: () => this.toggleSplitView()
      });
      this.toolbar.mount(this.container);
      return this;
    }
    this.toolbar.show();
    return this;
  }

  hideToolbar() {
    this.toolbar?.hide();
    return this;
  }

  toggleToolbar(forceVisible = null) {
    if (!this.toolbar) {
      return this.showToolbar();
    }
    this.toolbar.toggle(forceVisible);
    return this;
  }

  isToolbarVisible() {
    return this.toolbar ? this.toolbar.isVisible() : false;
  }

  showToolbarItem(key) {
    this.toolbar?.showItem(key);
    return this;
  }

  hideToolbarItem(key) {
    this.toolbar?.hideItem(key);
    return this;
  }

  toggleToolbarItem(key, forceVisible = null) {
    this.toolbar?.toggleItem(key, forceVisible);
    return this;
  }

  isToolbarItemVisible(key) {
    return this.toolbar ? this.toolbar.isItemVisible(key) : false;
  }

  setToolbarItemVisibility(key, visible) {
    this.toolbar?.setItemVisibility(key, visible);
    return this;
  }

  setToolbarItemsVisibility(itemsMap) {
    this.toolbar?.setItemsVisibility(itemsMap);
    return this;
  }

  setToolbarDefaults(defaults) {
    return this.toolbar?.setDefaults(defaults);
  }

  getToolbarDefaults() {
    return this.toolbar?.getDefaults();
  }

  // Document Import & Opening
  async importDocument(file) {
    const html = await this.core.importDocument(file);
    return html;
  }

  browseAndOpen() {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') return reject(new Error('Browser environment required'));
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.docx,.doc,.html,.htm,.md,.markdown,.txt';
      input.style.display = 'none';
      input.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const html = await this.importDocument(file);
          document.body.removeChild(input);
          resolve({ file, html });
        } catch (err) {
          document.body.removeChild(input);
          reject(err);
        }
      };
      document.body.appendChild(input);
      input.click();
    });
  }

  // Document Exporting
  exportDOCX(filename = 'document.doc') {
    const sync = this.sync || new SyncAdapter(this.core);
    sync.exportDOCX(filename);
  }

  exportMarkdown(filename = 'document.md') {
    const sync = this.sync || new SyncAdapter(this.core);
    sync.exportMarkdown(filename);
  }

  exportHTML(filename = 'document.html') {
    const sync = this.sync || new SyncAdapter(this.core);
    sync.exportHTML(filename);
  }

  exportJSON(filename = 'document.json') {
    const sync = this.sync || new SyncAdapter(this.core);
    sync.exportJSON(filename);
  }

  exportText(filename = 'document.txt') {
    const sync = this.sync || new SyncAdapter(this.core);
    sync.exportText(filename);
  }

  // Real-Time Collaboration Controls
  disconnectCollab() {
    if (this.collab) {
      this.collab.disconnect();
    }
  }

  connectCollab(serverUrl) {
    if (this.collab) {
      this.collab.connect(serverUrl);
    }
  }

  isCollabConnected() {
    return this.collab ? Boolean(this.collab.isConnected) : false;
  }

  destroy() {
    if (this.bubbleMenu) this.bubbleMenu.destroy();
    if (this.slashCommand) this.slashCommand.destroy();
    if (this.splitView) this.splitView.destroy();
    if (this.collab) this.collab.destroy();
    if (this.sync) this.sync.destroy();
    if (this.toolbar) this.toolbar.destroy();
    if (this.core) this.core.destroy();

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

export {
  EditorCore,
  Toolbar,
  BubbleMenu,
  SlashCommand,
  SplitView,
  CollabEngine,
  SyncAdapter,
  escapeHtml,
  sanitizeUrl,
  readDocumentFile,
  parseDocxFile
};

export default RichEditor;
