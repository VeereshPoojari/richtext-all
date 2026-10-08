/**
 * Toolbar.js - Full Interactive Two-Row Docked & Sticky Toolbar
 * Matching Google Docs / TipTap layout with native mode switching & document imports.
 */

import { escapeHtml } from '../utils/security.js';

export const ITEM_ALIASES = {
  heading: 'style',
  headings: 'style',
  font: 'fontSize',
  fonts: 'typography',
  lineSpacing: 'lineHeight',
  spacing: 'lineHeight',
  strikethrough: 'strikeThrough',
  clearFormatting: 'removeFormat',
  clearFormat: 'removeFormat',
  tx: 'removeFormat',
  textColor: 'color',
  pen: 'color',
  bgColor: 'highlight',
  highlightColor: 'highlight',
  swatch: 'highlight',
  alignment: 'align',
  lists: 'list',
  unorderedList: 'bulletList',
  insertUnorderedList: 'bulletList',
  bullets: 'bulletList',
  orderedList: 'orderedList',
  insertOrderedList: 'orderedList',
  numbers: 'orderedList',
  pageLayout: 'layout',
  comments: 'comment',
  addComment: 'comment',
  gutter: 'margin',
  gutterPos: 'margin',
  gutterPosition: 'margin',
  cardsPosition: 'margin',
  saveVersion: 'saveVersion',
  versionHistory: 'saveVersion',
  saveVer: 'saveVersion',
  checkpoint: 'saveVersion',
  user: 'users',
  collaborators: 'users',
  documentMode: 'mode'
};

export class Toolbar {
  constructor(editor, options = {}) {
    this.editor = editor;
    this.options = {
      sticky: true,
      visible: true,
      defaults: {},
      show: {},
      hiddenItems: [],
      ...options
    };

    this.visible = this.options.visible !== false;

    this.defaults = {
      style: 'p',
      fontSize: '16',
      lineHeight: '1.6',
      color: '#0f172a',
      highlight: '#facc15',
      layout: this.editor?.pageLayout || 'a4',
      margin: this.editor?.getGutterPosition?.() || 'right',
      mode: 'editing',
      tableRows: 3,
      tableCols: 3,
      ...this.options.defaults
    };

    this.element = null;
    this.hiddenItemKeys = new Set(
      (this.options.hiddenItems || this.options.hidden || []).map(k => this.resolveItemKey(k))
    );

    // Process show map: if show.key === false, add to hiddenItemKeys; if true, remove
    if (this.options.show && typeof this.options.show === 'object') {
      Object.entries(this.options.show).forEach(([k, v]) => {
        const resolved = this.resolveItemKey(k);
        if (v === false) {
          this.hiddenItemKeys.add(resolved);
        } else if (v === true) {
          this.hiddenItemKeys.delete(resolved);
        }
      });
    }
  }

  mount(containerEl) {
    const parent = containerEl || this.options.container;
    if (!parent) return;

    this.element = document.createElement('div');
    this.element.className = 'rta-toolbar rta-toolbar-sticky';
    if (!this.visible) {
      this.element.classList.add('rta-hidden');
    }

    this.renderItems();
    parent.insertBefore(this.element, parent.firstChild);
    this.applyVisibility();
    this.bindEvents();
    this.bindEditorState();
    this.applyDefaultsToEditor();
  }

  applyDefaultsToEditor() {
    if (!this.editor) return;
    if (this.defaults.layout && this.editor.setLayout) {
      this.editor.setLayout(this.defaults.layout);
    }
    if (this.defaults.margin && this.editor.setGutterPosition) {
      this.editor.setGutterPosition(this.defaults.margin);
    }
    if (this.defaults.mode && this.defaults.mode !== 'editing' && this.editor.setMode) {
      this.editor.setMode(this.defaults.mode);
    }
  }

  renderItems() {
    this.element.innerHTML = `
      <!-- Row 1: Document & Text Formatting Ribbon -->
      <div class="rta-toolbar-row rta-toolbar-row-top">
        <!-- 1. Open DOCX / Document Button -->
        <button type="button" class="rta-btn rta-btn-upload" data-action="upload" data-item="upload" title="Open and Edit Document (.docx, .doc, .md, .html, .txt)">
          <span class="rta-btn-icon">📂</span> Open DOCX
        </button>

        <div class="rta-toolbar-divider" data-divider="upload"></div>

        <!-- 2. History: Undo, Redo -->
        <div class="rta-toolbar-group" data-item="history">
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="undo" data-item="undo" title="Undo (Ctrl+Z)">↶</button>
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="redo" data-item="redo" title="Redo (Ctrl+Y)">↷</button>
        </div>

        <div class="rta-toolbar-divider" data-divider="history"></div>

        <!-- 3. Text Style Dropdown (Paragraph, H1-H6, Quote, Code) -->
        <div class="rta-toolbar-group" data-item="style">
          <select class="rta-select rta-select-style" data-cmd="heading" data-item="style" title="Text Style">
            <option value="p" ${this.defaults.style === 'p' ? 'selected' : ''}>¶ Paragraph</option>
            <option value="h1" ${this.defaults.style === 'h1' ? 'selected' : ''}>H1 Heading 1</option>
            <option value="h2" ${this.defaults.style === 'h2' ? 'selected' : ''}>H2 Heading 2</option>
            <option value="h3" ${this.defaults.style === 'h3' ? 'selected' : ''}>H3 Heading 3</option>
            <option value="h4" ${this.defaults.style === 'h4' ? 'selected' : ''}>H4 Heading 4</option>
            <option value="h5" ${this.defaults.style === 'h5' ? 'selected' : ''}>H5 Heading 5</option>
            <option value="h6" ${this.defaults.style === 'h6' ? 'selected' : ''}>H6 Heading 6</option>
            <option value="blockquote" ${this.defaults.style === 'blockquote' ? 'selected' : ''}>❞ Quote</option>
            <option value="codeBlock" ${this.defaults.style === 'codeBlock' ? 'selected' : ''}>‹/› Code Block</option>
          </select>
        </div>

        <div class="rta-toolbar-divider" data-divider="style"></div>

        <!-- 4. Typography: Font Size & Line Spacing -->
        <div class="rta-toolbar-group" data-item="typography">
          <select class="rta-select rta-select-fontsize" data-cmd="fontSize" data-item="fontSize" title="Font Size">
            <option value="12" ${String(this.defaults.fontSize) === '12' ? 'selected' : ''}>12 px</option>
            <option value="14" ${String(this.defaults.fontSize) === '14' ? 'selected' : ''}>14 px</option>
            <option value="16" ${String(this.defaults.fontSize) === '16' ? 'selected' : ''}>16 px</option>
            <option value="18" ${String(this.defaults.fontSize) === '18' ? 'selected' : ''}>18 px</option>
            <option value="20" ${String(this.defaults.fontSize) === '20' ? 'selected' : ''}>20 px</option>
            <option value="24" ${String(this.defaults.fontSize) === '24' ? 'selected' : ''}>24 px</option>
            <option value="32" ${String(this.defaults.fontSize) === '32' ? 'selected' : ''}>32 px</option>
          </select>

          <select class="rta-select rta-select-lineheight" data-cmd="lineHeight" data-item="lineHeight" title="Line Spacing">
            <option value="1.0" ${String(this.defaults.lineHeight) === '1.0' ? 'selected' : ''}>1.0 ↕</option>
            <option value="1.2" ${String(this.defaults.lineHeight) === '1.2' ? 'selected' : ''}>1.2 ↕</option>
            <option value="1.4" ${String(this.defaults.lineHeight) === '1.4' ? 'selected' : ''}>1.4 ↕</option>
            <option value="1.5" ${String(this.defaults.lineHeight) === '1.5' ? 'selected' : ''}>1.5 ↕</option>
            <option value="1.6" ${String(this.defaults.lineHeight) === '1.6' ? 'selected' : ''}>1.6 ↕</option>
            <option value="2.0" ${String(this.defaults.lineHeight) === '2.0' ? 'selected' : ''}>2.0 ↕</option>
          </select>
        </div>

        <div class="rta-toolbar-divider" data-divider="typography"></div>

        <!-- 5. Formatting Buttons: B, I, U, S, Tx -->
        <div class="rta-toolbar-group" data-item="formatting">
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="bold" data-item="bold" title="Bold (Ctrl+B)"><b>B</b></button>
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="italic" data-item="italic" title="Italic (Ctrl+I)"><i>I</i></button>
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="underline" data-item="underline" title="Underline (Ctrl+U)"><u>U</u></button>
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="strikeThrough" data-item="strikeThrough" title="Strikethrough"><s>S</s></button>
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="removeFormat" data-item="removeFormat" title="Clear Formatting (Tx)">T<sub style="font-size:9px">x</sub></button>
        </div>

        <div class="rta-toolbar-divider" data-divider="formatting"></div>

        <!-- 6. Colors: Text Color & Highlight Color -->
        <div class="rta-toolbar-group" data-item="colors">
          <label class="rta-color-label" data-item="color" title="Font / Text Color">
            <span class="rta-color-pen-icon">🖊️</span>
            <input type="color" class="rta-color-input" data-cmd="color" value="${escapeHtml(this.defaults.color || '#0f172a')}" />
          </label>

          <label class="rta-swatch-label" data-item="highlight" title="Highlight Background Color">
            <span class="rta-swatch-box" id="rta-swatch-preview" style="background-color: ${escapeHtml(this.defaults.highlight || '#facc15')};"></span>
            <input type="color" class="rta-color-input" data-cmd="highlight" value="${escapeHtml(this.defaults.highlight || '#facc15')}" />
          </label>
        </div>
      </div>

      <!-- Row 2: Structure, Layout, Inserts & Collaboration Ribbon -->
      <div class="rta-toolbar-row rta-toolbar-row-bottom">
        <!-- 7. Alignments: Left, Center, Right, Justify -->
        <div class="rta-toolbar-group" data-item="align">
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="justifyLeft" data-item="justifyLeft" title="Align Left">⇤</button>
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="justifyCenter" data-item="justifyCenter" title="Align Center">≡</button>
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="justifyRight" data-item="justifyRight" title="Align Right">⇥</button>
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="justifyFull" data-item="justifyFull" title="Justify">≡</button>
        </div>

        <div class="rta-toolbar-divider" data-divider="align"></div>

        <!-- 8. Lists Group: Bullet & Numbered -->
        <div class="rta-toolbar-group" data-item="list">
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="insertUnorderedList" data-item="bulletList" title="Bulleted List">≡:</button>
          <button type="button" class="rta-btn rta-btn-fmt" data-cmd="insertOrderedList" data-item="orderedList" title="Numbered List">1≡:</button>
        </div>

        <div class="rta-toolbar-divider" data-divider="list"></div>

        <!-- 9. Insert Group: Link, Image, Table -->
        <div class="rta-toolbar-group" data-item="insert">
          <!-- 1. Link Popover -->
          <div class="rta-dropdown-wrap" data-item="link">
            <button type="button" class="rta-btn rta-btn-fmt" data-action="toggleLinkMenu" title="Insert Link (URL)">🔗</button>
            <div class="rta-popover-row" id="rta-link-popover" style="display: none;">
              <span class="rta-popover-label">Link URL:</span>
              <input type="text" id="rta-link-url-input" placeholder="https://..." class="rta-input-url" />
              <button type="button" class="rta-btn-confirm" id="rta-btn-confirm-insert-link">Apply</button>
            </div>
          </div>

          <!-- 2. Image Popover -->
          <div class="rta-dropdown-wrap" data-item="image">
            <button type="button" class="rta-btn rta-btn-fmt" data-action="toggleImageMenu" title="Insert Image">🖼️</button>
            <div class="rta-popover-row" id="rta-image-popover" style="display: none;">
              <span class="rta-popover-label">Image:</span>
              <input type="text" id="rta-image-url-input" placeholder="Paste URL (https://...)" class="rta-input-url" style="width: 175px;" />
              <button type="button" class="rta-btn-confirm" id="rta-btn-confirm-insert-image">Insert</button>
              <span style="color:#94a3b8; font-size:11px; user-select:none;">or</span>
              <button type="button" class="rta-btn-file-upload" id="rta-btn-upload-local-image" title="Choose image file from computer">📁 Upload File</button>
              <input type="file" id="rta-local-image-input" accept="image/*" style="display: none;" />
            </div>
          </div>

          <!-- 3. Table Popover -->
          <div class="rta-dropdown-wrap" data-item="table">
            <button type="button" class="rta-btn rta-btn-fmt" data-action="toggleTableMenu" title="Insert Table (Rows & Columns)">⊞</button>
            <div class="rta-popover-row" id="rta-table-popover" style="display: none;">
              <span class="rta-popover-label">Rows:</span>
              <input type="number" id="rta-table-rows-input" value="${parseInt(this.defaults.tableRows, 10) || 3}" min="1" max="50" class="rta-table-input-compact" />
              <span class="rta-table-popover-x">×</span>
              <span class="rta-table-popover-label">Cols:</span>
              <input type="number" id="rta-table-cols-input" value="${parseInt(this.defaults.tableCols, 10) || 3}" min="1" max="50" class="rta-table-input-compact" />
              <button type="button" class="rta-btn-confirm" id="rta-btn-confirm-insert-table">Insert</button>
            </div>
          </div>
        </div>

        <div class="rta-toolbar-divider" data-divider="insert"></div>

        <!-- 10. Page Management: Add Page & Layout -->
        <div class="rta-toolbar-group" data-item="page">
          <button type="button" class="rta-btn rta-btn-icon-only" data-action="addPage" data-item="addPage" title="Insert New Page / Page Break">
            📄<sup style="font-size:10px; font-weight:700;">+</sup> Add Page
          </button>

          <select class="rta-select rta-select-page" data-cmd="layout" data-item="layout" title="Page Layout">
            <option value="a4" ${this.defaults.layout === 'a4' ? 'selected' : ''}>A4 (210×297mm)</option>
            <option value="letter" ${this.defaults.layout === 'letter' ? 'selected' : ''}>Letter (8.5×11in)</option>
            <option value="legal" ${this.defaults.layout === 'legal' ? 'selected' : ''}>Legal (8.5×14in)</option>
            <option value="infinite" ${this.defaults.layout === 'infinite' ? 'selected' : ''}>Web (Infinite 100%)</option>
          </select>
        </div>

        <div class="rta-toolbar-divider" data-divider="page"></div>

        <!-- 11. Review: Comment, Margin Position & Save Version -->
        <div class="rta-toolbar-group" data-item="review">
          <button type="button" class="rta-btn rta-btn-comment" data-action="addComment" data-item="comment" title="Add Comment on Selection (Ctrl+Alt+M)">
            <span class="rta-btn-icon">💬</span> Comment
          </button>

          <select class="rta-select rta-select-gutter-pos" id="rta-gutter-pos-select" data-item="margin" title="Annotation Cards Space (Left, Right, or Both Sides)">
            <option value="right" ${this.defaults.margin === 'right' ? 'selected' : ''}>Margin: ➡ Right</option>
            <option value="left" ${this.defaults.margin === 'left' ? 'selected' : ''}>Margin: ⬅ Left</option>
            <option value="both" ${this.defaults.margin === 'both' ? 'selected' : ''}>Margin: ⇋ Both Sides</option>
          </select>

          <button type="button" class="rta-btn rta-btn-save-ver" data-action="saveNewVersion" data-item="saveVersion" title="Save Current Document as a New Version Checkpoint">
            <span class="rta-btn-icon">💾</span> Save Version
          </button>
        </div>

        <!-- Spacer pushes Mode & User Switcher to the right side on wide viewports -->
        <div class="rta-toolbar-spacer"></div>

        <!-- 12. Mode Dropdown: Editing, Viewing, Suggesting, Comments, Version History, Version Comparison -->
        <div class="rta-toolbar-group" data-item="mode">
          <select class="rta-select rta-select-mode" data-cmd="mode" data-item="mode" title="Document Mode & Review">
            <option value="editing" ${this.defaults.mode === 'editing' ? 'selected' : ''}>✏️ Editing</option>
            <option value="viewing" ${this.defaults.mode === 'viewing' ? 'selected' : ''}>👁️ Viewing</option>
            <option value="suggesting" ${this.defaults.mode === 'suggesting' ? 'selected' : ''}>💡 Suggesting</option>
            <option value="comments" ${this.defaults.mode === 'comments' ? 'selected' : ''}>💬 Comments</option>
            <option value="version-history" ${this.defaults.mode === 'version-history' ? 'selected' : ''}>🕒 Version History</option>
            <option value="version-comparison" ${this.defaults.mode === 'version-comparison' ? 'selected' : ''}>⚖️ Version Comparison</option>
          </select>
        </div>

        <div class="rta-toolbar-divider" data-divider="mode"></div>

        <!-- 13. Active User Switcher & Add User Button -->
        <div class="rta-toolbar-group rta-user-toolbar-group" data-item="users" title="Current Active Editor / Author">
          <span class="rta-user-indicator-dot" id="rta-active-user-dot" style="background-color: ${this.editor.options?.user?.color || '#6366f1'};"></span>
          <select class="rta-select rta-select-user" id="rta-user-select" data-item="userSelect" title="Switch Active User">
            ${this.renderUserOptions()}
          </select>
          <button type="button" class="rta-btn rta-btn-add-user" id="rta-btn-add-user" data-item="addUser" title="Add New Collaborator">
            + User
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // CRITICAL: Prevent mousedown from taking focus away from editor
    // This preserves window.getSelection() so execCommand works 100% reliably!
    this.element.addEventListener('mousedown', (e) => {
      if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
      }
    });

    // Button clicks
    this.element.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const cmd = btn.getAttribute('data-cmd');
      const action = btn.getAttribute('data-action');

      if (cmd) {
        this.editor.format(cmd);
      } else if (action === 'upload') {
        // Upload document (.docx, .doc, .md, .html, .txt)
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.docx,.doc,.html,.htm,.md,.markdown,.txt';
        input.onchange = async (ev) => {
          const file = ev.target.files && ev.target.files[0];
          if (file) {
            await this.editor.importDocument(file);
          }
        };
        input.click();
      } else if (action === 'browse') {
        // Browse document (.docx, .doc, .html, .md, .txt) or image to insert/edit
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.docx,.doc,.html,.htm,.md,.markdown,.txt,image/*';
        input.onchange = async (ev) => {
          const file = ev.target.files && ev.target.files[0];
          if (!file) return;

          if (file.name.match(/\.(docx|doc|html|htm|md|markdown|txt)$/i) || file.type.includes('document') || file.type.includes('text')) {
            await this.editor.importDocument(file);
          } else if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
              this.editor.insertImage(loadEvent.target.result, file.name);
            };
            reader.readAsDataURL(file);
          } else {
            // Default to document import
            await this.editor.importDocument(file);
          }
        };
        input.click();
      } else if (action === 'addPage') {
        this.editor.addNewPage();
      } else if (action === 'toggleImageMenu' || action === 'image') {
        this.toggleImageMenu();
      } else if (action === 'toggleLinkMenu' || action === 'link') {
        this.toggleLinkMenu();
      } else if (action === 'toggleTableMenu' || action === 'table') {
        this.toggleTableMenu();
      } else if (action === 'addComment') {
        this.editor.openCommentDraft?.();
      } else if (action === 'toggleGutterPos') {
        const next = this.editor.toggleGutterPosition?.();
        const lbl = this.element.querySelector('#rta-gutter-pos-label');
        if (lbl) lbl.textContent = next === 'left' ? 'Left' : 'Right';
      } else if (action === 'saveNewVersion') {
        this.editor.toggleVersionHistoryModal?.();
      }
    });

    const gutterSelect = this.element.querySelector('#rta-gutter-pos-select');
    gutterSelect?.addEventListener('change', (e) => {
      this.editor.setGutterPosition?.(e.target.value);
    });

    // 1. Image Popover Handling
    const imgPopover = this.element.querySelector('#rta-image-popover');
    const imgConfirmBtn = this.element.querySelector('#rta-btn-confirm-insert-image');
    const imgUrlInput = this.element.querySelector('#rta-image-url-input');

    const handleConfirmImage = () => {
      const url = imgUrlInput?.value?.trim();
      if (url) {
        if (imgPopover) imgPopover.style.display = 'none';
        this.editor.insertImage(url);
        imgUrlInput.value = '';
      }
    };

    imgConfirmBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleConfirmImage();
    });

    imgUrlInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleConfirmImage();
      } else if (e.key === 'Escape') {
        if (imgPopover) imgPopover.style.display = 'none';
      }
    });

    const localImgBtn = this.element.querySelector('#rta-btn-upload-local-image');
    const localImgInput = this.element.querySelector('#rta-local-image-input');

    localImgBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      localImgInput?.click();
    });

    localImgInput?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          if (imgPopover) imgPopover.style.display = 'none';
          this.editor.insertImage(loadEvt.target.result, file.name);
          localImgInput.value = '';
        };
        reader.readAsDataURL(file);
      }
    });

    // 2. Link Popover Handling
    const linkPopover = this.element.querySelector('#rta-link-popover');
    const linkConfirmBtn = this.element.querySelector('#rta-btn-confirm-insert-link');
    const linkUrlInput = this.element.querySelector('#rta-link-url-input');

    const handleConfirmLink = () => {
      const url = linkUrlInput?.value?.trim();
      if (url) {
        if (linkPopover) linkPopover.style.display = 'none';
        this.editor.insertLink(url);
        linkUrlInput.value = '';
      }
    };

    linkConfirmBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleConfirmLink();
    });

    linkUrlInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleConfirmLink();
      } else if (e.key === 'Escape') {
        if (linkPopover) linkPopover.style.display = 'none';
      }
    });

    // 3. Table Popover Handling
    const tblPopover = this.element.querySelector('#rta-table-popover');
    const tblConfirmBtn = this.element.querySelector('#rta-btn-confirm-insert-table');
    const rowsInput = this.element.querySelector('#rta-table-rows-input');
    const colsInput = this.element.querySelector('#rta-table-cols-input');

    const handleConfirmTable = () => {
      const rows = Math.max(1, Math.min(50, parseInt(rowsInput?.value, 10) || 3));
      const cols = Math.max(1, Math.min(20, parseInt(colsInput?.value, 10) || 3));
      if (tblPopover) tblPopover.style.display = 'none';
      this.editor.insertTable(rows, cols);
    };

    tblConfirmBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleConfirmTable();
    });

    [rowsInput, colsInput].forEach(inp => {
      inp?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          handleConfirmTable();
        } else if (e.key === 'Escape') {
          if (tblPopover) tblPopover.style.display = 'none';
        }
      });
    });

    // Close any popover when clicking anywhere outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.rta-dropdown-wrap')) {
        this.closeAllPopovers();
      }
    });

    // Dropdown and color picker changes
    this.element.addEventListener('change', (e) => {
      const target = e.target;
      const cmd = target.getAttribute('data-cmd');
      const val = target.value;

      if (cmd === 'heading') {
        this.editor.format('heading', val);
      } else if (cmd === 'fontSize') {
        this.editor.format('fontSize', val);
      } else if (cmd === 'lineHeight') {
        this.editor.format('lineHeight', val);
      } else if (cmd === 'layout') {
        this.editor.setPageLayout(val);
      } else if (cmd === 'color') {
        this.editor.format('color', val);
      } else if (cmd === 'highlight') {
        const swatch = this.element.querySelector('#rta-swatch-preview');
        if (swatch) swatch.style.backgroundColor = val;
        this.editor.format('highlight', val);
      } else if (cmd === 'mode') {
        this.editor.setMode(val);
      }
    });

    // Active User Switcher & Add User Handlers
    const userSelect = this.element.querySelector('#rta-user-select');
    const userDot = this.element.querySelector('#rta-active-user-dot');
    const addUserBtn = this.element.querySelector('#rta-btn-add-user');

    userSelect?.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      this.editor.setUser(selectedId);
    });

    addUserBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.editor.promptAddUser();
    });

    this.editor.on('userChange', (user) => {
      if (userSelect && user) {
        userSelect.value = user.id;
      }
      if (userDot && user) {
        userDot.style.backgroundColor = user.color || '#6366f1';
      }
    });

    this.editor.on('usersChange', () => {
      if (userSelect) {
        userSelect.innerHTML = this.renderUserOptions();
        if (this.editor.options?.user) {
          userSelect.value = this.editor.options.user.id;
        }
      }
      if (userDot && this.editor.options?.user) {
        userDot.style.backgroundColor = this.editor.options.user.color || '#6366f1';
      }
    });
  }

  renderUserOptions() {
    const users = this.editor.getUsers ? this.editor.getUsers() : [this.editor.options.user];
    const currentId = this.editor.options.user?.id;
    return users.map(u => `
      <option value="${u.id}" ${u.id === currentId ? 'selected' : ''}>
        ${escapeHtml(u.name)}
      </option>
    `).join('');
  }

  bindEditorState() {
    this.editor.on('selectionChange', (state) => {
      if (!this.element) return;
      const buttons = this.element.querySelectorAll('button[data-cmd]');
      buttons.forEach(btn => {
        const cmd = btn.getAttribute('data-cmd');
        if (state.formats && state.formats[cmd]) {
          btn.classList.add('is-active');
        } else {
          btn.classList.remove('is-active');
        }
      });
    });

    this.editor.on('gutterPositionChange', (pos) => {
      const select = this.element?.querySelector('#rta-gutter-pos-select');
      if (select) select.value = pos;
      const lbl = this.element?.querySelector('#rta-gutter-pos-label');
      if (lbl) lbl.textContent = pos === 'left' ? 'Left' : (pos === 'both' ? 'Both' : 'Right');
    });
  }

  closeAllPopovers() {
    if (!this.element) return;
    const popovers = this.element.querySelectorAll('.rta-popover-row');
    popovers.forEach(p => { p.style.display = 'none'; });
  }

  toggleImageMenu(forceState = null) {
    const popover = this.element?.querySelector('#rta-image-popover');
    if (!popover) return;
    const isHidden = popover.style.display === 'none';
    const nextState = forceState !== null ? forceState : isHidden;
    this.closeAllPopovers();
    this.editor.saveSelection?.();
    popover.style.display = nextState ? 'flex' : 'none';
    if (nextState) {
      const input = this.element.querySelector('#rta-image-url-input');
      setTimeout(() => {
        input?.focus();
        input?.select();
      }, 50);
    }
  }

  toggleLinkMenu(forceState = null) {
    const popover = this.element?.querySelector('#rta-link-popover');
    if (!popover) return;
    const isHidden = popover.style.display === 'none';
    const nextState = forceState !== null ? forceState : isHidden;
    this.closeAllPopovers();
    this.editor.saveSelection?.();
    popover.style.display = nextState ? 'flex' : 'none';
    if (nextState) {
      const input = this.element.querySelector('#rta-link-url-input');
      setTimeout(() => {
        input?.focus();
        input?.select();
      }, 50);
    }
  }

  toggleTableMenu(forceState = null) {
    const popover = this.element?.querySelector('#rta-table-popover');
    if (!popover) return;
    const isHidden = popover.style.display === 'none';
    const nextState = forceState !== null ? forceState : isHidden;
    this.closeAllPopovers();
    this.editor.saveSelection?.();
    popover.style.display = nextState ? 'flex' : 'none';
    if (nextState) {
      const rowsInput = this.element.querySelector('#rta-table-rows-input');
      setTimeout(() => {
        rowsInput?.focus();
        rowsInput?.select();
      }, 50);
    }
  }

  // --- Toolbar & Item Visibility APIs ---
  show() {
    this.visible = true;
    if (this.element) {
      this.element.classList.remove('rta-hidden');
    }
    return this;
  }

  hide() {
    this.visible = false;
    if (this.element) {
      this.element.classList.add('rta-hidden');
    }
    return this;
  }

  toggle(forceState = null) {
    const next = forceState !== null ? Boolean(forceState) : !this.visible;
    return next ? this.show() : this.hide();
  }

  isVisible() {
    return this.visible && this.element ? !this.element.classList.contains('rta-hidden') : this.visible;
  }

  resolveItemKey(key) {
    if (!key) return '';
    const normalized = String(key).trim();
    return ITEM_ALIASES[normalized] || normalized;
  }

  showItem(key) {
    return this.setItemVisibility(key, true);
  }

  hideItem(key) {
    return this.setItemVisibility(key, false);
  }

  toggleItem(key, forceState = null) {
    const targetKey = this.resolveItemKey(key);
    const currentlyVisible = this.isItemVisible(targetKey);
    const nextState = forceState !== null ? Boolean(forceState) : !currentlyVisible;
    return this.setItemVisibility(targetKey, nextState);
  }

  isItemVisible(key) {
    const targetKey = this.resolveItemKey(key);
    if (!this.element) {
      return !this.hiddenItemKeys.has(targetKey);
    }
    const el = this.element.querySelector(`[data-item="${targetKey}"]`);
    if (!el) {
      return !this.hiddenItemKeys.has(targetKey);
    }
    return !el.classList.contains('rta-hidden');
  }

  setItemVisibility(key, visible) {
    const targetKey = this.resolveItemKey(key);
    if (visible) {
      this.hiddenItemKeys.delete(targetKey);
    } else {
      this.hiddenItemKeys.add(targetKey);
    }

    if (this.element) {
      const els = this.element.querySelectorAll(`[data-item="${targetKey}"]`);
      els.forEach(el => {
        if (visible) {
          el.classList.remove('rta-hidden');
        } else {
          el.classList.add('rta-hidden');
        }
      });
      this.updateDividers();
    }
    return this;
  }

  setItemsVisibility(config = {}) {
    if (typeof config !== 'object' || !config) return this;
    Object.entries(config).forEach(([k, v]) => {
      this.setItemVisibility(k, Boolean(v));
    });
    return this;
  }

  applyVisibility() {
    if (!this.element) return;

    if (Array.isArray(this.options.items) && this.options.items.length > 0) {
      const allowed = new Set(this.options.items.map(k => this.resolveItemKey(k)));
      const allItemEls = this.element.querySelectorAll('[data-item]');
      allItemEls.forEach(el => {
        const itemKey = el.getAttribute('data-item');
        if (!allowed.has(itemKey)) {
          this.hiddenItemKeys.add(itemKey);
          el.classList.add('rta-hidden');
        }
      });
    }

    this.hiddenItemKeys.forEach(key => {
      const els = this.element.querySelectorAll(`[data-item="${key}"]`);
      els.forEach(el => el.classList.add('rta-hidden'));
    });

    this.updateDividers();
  }

  updateDividers() {
    if (!this.element) return;

    const groups = this.element.querySelectorAll('.rta-toolbar-group');
    groups.forEach(group => {
      const childItems = group.querySelectorAll('[data-item]');
      if (childItems.length > 0) {
        const anyVisible = Array.from(childItems).some(c => !c.classList.contains('rta-hidden'));
        if (!anyVisible) {
          group.classList.add('rta-hidden');
        } else if (!this.hiddenItemKeys.has(group.getAttribute('data-item'))) {
          group.classList.remove('rta-hidden');
        }
      }
    });

    const rows = this.element.querySelectorAll('.rta-toolbar-row');
    rows.forEach(row => {
      const dividers = row.querySelectorAll('.rta-toolbar-divider');
      dividers.forEach(div => {
        const divKey = div.getAttribute('data-divider');
        const isAssociatedHidden = divKey && (
          this.hiddenItemKeys.has(this.resolveItemKey(divKey)) ||
          row.querySelector(`[data-item="${this.resolveItemKey(divKey)}"]`)?.classList.contains('rta-hidden')
        );
        if (isAssociatedHidden) {
          div.classList.add('rta-hidden');
        } else {
          div.classList.remove('rta-hidden');
        }
      });
    });
  }

  // --- Toolbar Defaults Management ---
  getDefaults() {
    return { ...this.defaults };
  }

  setDefaults(newDefaults = {}) {
    this.defaults = {
      ...this.defaults,
      ...newDefaults
    };

    if (!this.element) return this.defaults;

    if (newDefaults.style !== undefined) {
      const el = this.element.querySelector('.rta-select-style');
      if (el) el.value = newDefaults.style;
    }
    if (newDefaults.fontSize !== undefined) {
      const el = this.element.querySelector('.rta-select-fontsize');
      if (el) el.value = String(newDefaults.fontSize);
    }
    if (newDefaults.lineHeight !== undefined) {
      const el = this.element.querySelector('.rta-select-lineheight');
      if (el) el.value = String(newDefaults.lineHeight);
    }
    if (newDefaults.color !== undefined) {
      const el = this.element.querySelector('input[data-cmd="color"]');
      if (el) el.value = newDefaults.color;
    }
    if (newDefaults.highlight !== undefined) {
      const el = this.element.querySelector('input[data-cmd="highlight"]');
      if (el) el.value = newDefaults.highlight;
      const swatch = this.element.querySelector('#rta-swatch-preview');
      if (swatch) swatch.style.backgroundColor = newDefaults.highlight;
    }
    if (newDefaults.layout !== undefined) {
      const el = this.element.querySelector('.rta-select-page');
      if (el) el.value = newDefaults.layout;
      this.editor?.setLayout?.(newDefaults.layout);
    }
    if (newDefaults.margin !== undefined || newDefaults.gutterPosition !== undefined) {
      const pos = newDefaults.margin || newDefaults.gutterPosition;
      const el = this.element.querySelector('#rta-gutter-pos-select');
      if (el) el.value = pos;
      this.editor?.setGutterPosition?.(pos);
    }
    if (newDefaults.mode !== undefined) {
      const el = this.element.querySelector('.rta-select-mode');
      if (el) el.value = newDefaults.mode;
      this.editor?.setMode?.(newDefaults.mode);
    }
    if (newDefaults.tableRows !== undefined) {
      const el = this.element.querySelector('#rta-table-rows-input');
      if (el) el.value = String(newDefaults.tableRows);
    }
    if (newDefaults.tableCols !== undefined) {
      const el = this.element.querySelector('#rta-table-cols-input');
      if (el) el.value = String(newDefaults.tableCols);
    }

    return this.defaults;
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

export default Toolbar;
