import { sanitizeHtml, sanitizeUrl, sanitizeColor, escapeHtml } from '../utils/security.js';
import { readDocumentFile } from '../utils/docxReader.js';
import { computeDocumentDiff } from '../utils/diff.js';

export class EditorCore {
  constructor(containerOrOptions = {}, options = {}) {
    let opts = {};
    let targetEl = null;

    if (
      (typeof HTMLElement !== 'undefined' && containerOrOptions instanceof HTMLElement) ||
      (typeof containerOrOptions === 'string')
    ) {
      targetEl = containerOrOptions;
      opts = options || {};
    } else {
      opts = containerOrOptions || {};
    }

    const initialUser = opts.user || {
      id: `usr-${Math.random().toString(36).substr(2, 6)}`,
      name: 'You (Author)',
      color: '#6366f1'
    };

    this.options = {
      placeholder: 'Write something or press \'/\' for commands...',
      pageLayout: 'a4', // 'a4' | 'letter' | 'legal' | 'infinite'
      gutterPosition: opts.gutterPosition || 'right', // 'right' | 'left'
      readOnly: false,
      autoFocus: false,
      initialContent: '',
      user: initialUser,
      ...opts
    };

    this.users = opts.users && Array.isArray(opts.users) && opts.users.length > 0
      ? [...opts.users]
      : [
          this.options.user,
          { id: 'usr-veeresh', name: 'Veeresh Poojari (Author)', color: '#6366f1' },
          { id: 'usr-sarah', name: 'Sarah (Design Lead)', color: '#ec4899' },
          { id: 'usr-alex', name: 'Alex (Tech Lead)', color: '#059669' }
        ];

    if (!this.users.some(u => u.id === this.options.user.id || u.name === this.options.user.name)) {
      this.users.unshift(this.options.user);
    }

    this.container = null;
    this.contentArea = null;
    this.el = null; // Alias for contentArea
    this.listeners = new Map();
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 80;
    this.isRecordingHistory = true;
    this.savedSelection = null;
    this.isComposing = false;
    this.mode = 'editing'; // 'editing' | 'viewing' | 'suggesting' | 'comments'
    this.comments = [];
    this.suggestions = [];
    this.activeDraftComment = null;
    this.cardsGutter = null;
    this.leftGutter = null;
    this.rightGutter = null;
    this.clusterCollapseTimer = null;
    this.versions = [
      {
        id: 'ver-initial',
        title: 'Initial Document Draft',
        html: this.options.initialContent || '<p><br></p>',
        timestamp: new Date().toLocaleTimeString(),
        author: this.options.user?.name || 'Author',
        words: 0
      }
    ];
    this.pages = [];
    this.pagesContainer = null;
    this.annotationTooltipEl = null;
    this.isPaginating = false;
    this.activeHoveredCluster = null;

    if (targetEl) {
      this.mount(targetEl);
    }
  }

  mount(containerEl) {
    if (typeof containerEl === 'string') {
      this.container = document.querySelector(containerEl);
    } else {
      this.container = containerEl;
    }

    if (!this.container) {
      throw new Error('RichText-All: Mount container not found.');
    }

    this.container.classList.add('rta-editor-root');
    this.renderDOM();
    this.recordSnapshot();

    if (this.options.autoFocus && this.contentArea) {
      this.focus();
    }
  }

  renderDOM() {
    this.pagesContainer = document.createElement('div');
    this.pagesContainer.className = 'rta-pages-wrapper';
    this.container.appendChild(this.pagesContainer);

    this.leftGutter = document.createElement('div');
    this.leftGutter.className = 'rta-cards-gutter rta-cards-gutter-left is-left';
    this.leftGutter.setAttribute('data-gutter-side', 'left');
    this.container.appendChild(this.leftGutter);

    this.rightGutter = document.createElement('div');
    this.rightGutter.className = 'rta-cards-gutter rta-cards-gutter-right is-right';
    this.rightGutter.setAttribute('data-gutter-side', 'right');
    this.container.appendChild(this.rightGutter);

    this.cardsGutter = this.rightGutter;
    const initialGutterPos = this.options.gutterPosition || 'right';
    this.container.setAttribute('data-gutter-position', initialGutterPos);

    const page1 = this.createPageSheet(1, this.options.initialContent);
    this.pages = [page1];
    this.contentArea = page1;
    this.el = page1;
    this.pagesContainer.appendChild(page1);

    this.initGutterEvents();

    window.addEventListener('resize', () => {
      this.updateGutterPositions();
      this.hideAnnotationTooltip();
    });
    window.addEventListener('scroll', () => {
      this.updateGutterPositions();
      this.hideAnnotationTooltip();
    }, { passive: true });
    this.container.addEventListener('scroll', () => {
      this.updateGutterPositions();
      this.hideAnnotationTooltip();
    }, { passive: true });

    document.addEventListener('selectionchange', () => {
      if (this.isEditorFocused()) {
        this.emit('selectionChange', this.getSelectionState());
      }
    });
  }

  createPageSheet(pageNumber, initialHtml = '<p><br></p>') {
    const page = document.createElement('div');
    page.className = `rta-page-sheet rta-editor rta-content-editable rta-layout-${this.options.pageLayout}`;
    page.setAttribute('data-page-number', pageNumber);
    page.contentEditable = !this.options.readOnly;
    page.setAttribute('role', 'textbox');
    page.setAttribute('aria-multiline', 'true');
    page.setAttribute('spellcheck', 'true');

    if (this.options.placeholder && pageNumber === 1) {
      page.setAttribute('data-placeholder', this.options.placeholder);
    }

    const header = document.createElement('div');
    header.className = 'rta-page-header-bar';
    header.contentEditable = 'false';
    header.innerHTML = `
      <span class="rta-page-num-pill">Page ${pageNumber}</span>
      ${pageNumber > 1 ? '<button type="button" class="rta-page-del-btn" title="Remove page">✕ Remove Page</button>' : ''}
    `;

    const body = document.createElement('div');
    body.className = 'rta-page-body';
    body.innerHTML = sanitizeHtml(initialHtml || '<p><br></p>');

    page.appendChild(header);
    page.appendChild(body);

    header.querySelector('.rta-page-del-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removePage(pageNumber);
    });

    this.bindPageEvents(page);
    return page;
  }

  bindPageEvents(page) {
    page.addEventListener('focus', () => {
      this.contentArea = page;
      this.el = page;
    }, true);

    page.addEventListener('click', () => {
      this.contentArea = page;
      this.el = page;
    });

    page.addEventListener('input', () => {
      this.handleInput();
    });

    page.addEventListener('keyup', () => {
      this.handleInput();
    });

    page.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    page.addEventListener('compositionstart', () => {
      this.isComposing = true;
    });

    page.addEventListener('compositionend', () => {
      this.isComposing = false;
      this.handleInput();
    });

    page.addEventListener('beforeinput', (e) => {
      this.handleBeforeInput(e);
    });

    page.addEventListener('mouseup', () => {
      if (this.mode === 'comments') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed && this.isEditorFocused()) {
          if (!this.activeDraftComment) {
            this.openCommentDraft();
          }
        }
      }
    });

    page.addEventListener('paste', (e) => {
      this.handlePaste(e);
    });
  }

  addNewPage() {
    const newPageNum = this.pages.length + 1;
    const newPage = this.createPageSheet(newPageNum, '<p><br></p>');
    this.pages.push(newPage);
    this.pagesContainer.appendChild(newPage);
    this.contentArea = newPage;
    this.el = newPage;

    const p = newPage.querySelector('.rta-page-body p') || newPage;
    p.focus();
    newPage.scrollIntoView({ behavior: 'smooth', block: 'center' });

    this.handleInput();
    this.emit('pageAdded', { pageNumber: newPageNum, totalPages: this.pages.length });
    return newPage;
  }

  removePage(pageNumber) {
    if (this.pages.length <= 1) return;
    const index = this.pages.findIndex(p => parseInt(p.getAttribute('data-page-number')) === pageNumber);
    if (index >= 0) {
      const [removed] = this.pages.splice(index, 1);
      removed.remove();
      this.pages.forEach((p, idx) => {
        const num = idx + 1;
        p.setAttribute('data-page-number', num);
        const pill = p.querySelector('.rta-page-num-pill');
        if (pill) pill.textContent = `Page ${num}`;
      });
      const active = this.pages[Math.max(0, index - 1)];
      this.contentArea = active;
      this.el = active;
      active.focus();
      this.handleInput();
      this.emit('pageRemoved', { totalPages: this.pages.length });
    }
  }

  getBodyHeightBudget(page) {
    const layout = this.options.pageLayout || 'infinite';
    switch (layout) {
      case 'a4': return 960;
      case 'letter': return 890;
      case 'legal': return 1180;
      case 'infinite': return 850;
      default: return 960;
    }
  }

  renumberPages() {
    if (!this.pages) return;
    this.pages.forEach((p, idx) => {
      const num = idx + 1;
      p.setAttribute('data-page-number', num);
      const pill = p.querySelector('.rta-page-num-pill');
      if (pill) pill.textContent = `Page ${num}`;
      const delBtn = p.querySelector('.rta-page-del-btn');
      if (num === 1 && delBtn) {
        delBtn.remove();
      } else if (num > 1 && !delBtn) {
        const header = p.querySelector('.rta-page-header-bar');
        if (header) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'rta-page-del-btn';
          btn.title = 'Remove page';
          btn.textContent = '✕ Remove Page';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removePage(num);
          });
          header.appendChild(btn);
        }
      }
    });
  }

  checkAutoPagination(targetPage = null) {
    if (this.isPaginating) return;
    if (!this.pages || this.pages.length === 0) return;

    this.isPaginating = true;
    try {
      const getRelativeBottom = (child, body) => {
        if (child.getBoundingClientRect && body.getBoundingClientRect) {
          const cRect = child.getBoundingClientRect();
          const bRect = body.getBoundingClientRect();
          if (cRect.bottom > 0 && bRect.top > 0) {
            return cRect.bottom - bRect.top;
          }
        }
        return (child.offsetTop || 0) + (child.offsetHeight || 0);
      };

      const getRelativeTop = (child, body) => {
        if (child.getBoundingClientRect && body.getBoundingClientRect) {
          const cRect = child.getBoundingClientRect();
          const bRect = body.getBoundingClientRect();
          if (cRect.top > 0 && bRect.top > 0) {
            return cRect.top - bRect.top;
          }
        }
        return child.offsetTop || 0;
      };

      for (let i = 0; i < this.pages.length; i++) {
        const page = this.pages[i];
        const body = page.querySelector('.rta-page-body');
        if (!body) continue;

        const budget = this.getBodyHeightBudget(page);
        const currentBodyHeight = Math.max(body.offsetHeight || 0, body.scrollHeight || 0);

        if (currentBodyHeight <= budget + 15) {
          continue;
        }

        const children = Array.from(body.children);
        if (children.length === 0) continue;

        const overflowNodes = [];
        let splitParagraph = null;
        let splitWordsLeft = null;
        let splitWordsRight = null;

        for (let c = 0; c < children.length; c++) {
          const child = children[c];
          const childBottom = getRelativeBottom(child, body);
          const childTop = getRelativeTop(child, body);

          if (childBottom > budget) {
            if (childTop < budget - 50 && child.nodeName === 'P' && child.textContent.length > 50 && overflowNodes.length === 0) {
              const text = child.textContent;
              const words = text.split(' ');
              if (words.length > 8) {
                const ratio = Math.max(0.2, Math.min(0.8, (budget - childTop) / Math.max(1, childBottom - childTop)));
                const splitIndex = Math.max(1, Math.min(words.length - 1, Math.floor(words.length * ratio)));
                splitWordsLeft = words.slice(0, splitIndex).join(' ');
                splitWordsRight = words.slice(splitIndex).join(' ');
                splitParagraph = child;
                continue;
              }
            }
            overflowNodes.push(child);
          }
        }

        if (overflowNodes.length > 0 || splitParagraph) {
          let nextPage = this.pages[i + 1];
          if (!nextPage) {
            const nextNum = this.pages.length + 1;
            nextPage = this.createPageSheet(nextNum, '<p><br></p>');
            this.pages.push(nextPage);
            this.pagesContainer.appendChild(nextPage);
            this.emit('pageAdded', { pageNumber: nextNum, totalPages: this.pages.length });
          }

          const nextBody = nextPage.querySelector('.rta-page-body');
          if (!nextBody) continue;

          const sel = window.getSelection();
          let caretInMoved = false;
          let caretNode = null;
          let caretOffset = 0;

          if (sel && sel.rangeCount > 0 && this.isEditorFocused()) {
            caretNode = sel.anchorNode;
            caretOffset = sel.anchorOffset;
            for (const node of overflowNodes) {
              if (node.contains(caretNode)) {
                caretInMoved = true;
                break;
              }
            }
            if (splitParagraph && splitParagraph.contains(caretNode)) {
              caretInMoved = true;
            }
          }

          if (nextBody.children.length === 1 && (nextBody.firstElementChild?.innerHTML === '<br>' || nextBody.textContent.trim() === '')) {
            nextBody.innerHTML = '';
          }

          let targetCaretEl = null;

          if (splitParagraph && splitWordsRight) {
            splitParagraph.textContent = splitWordsLeft;
            const newP = document.createElement('p');
            newP.textContent = splitWordsRight;
            if (nextBody.firstChild) {
              nextBody.insertBefore(newP, nextBody.firstChild);
            } else {
              nextBody.appendChild(newP);
            }
            targetCaretEl = newP;
          }

          for (let n = overflowNodes.length - 1; n >= 0; n--) {
            const node = overflowNodes[n];
            if (nextBody.firstChild) {
              nextBody.insertBefore(node, nextBody.firstChild);
            } else {
              nextBody.appendChild(node);
            }
            if (!targetCaretEl && caretInMoved) {
              targetCaretEl = node;
            }
          }

          this.renumberPages();

          if (caretInMoved && targetCaretEl) {
            this.contentArea = nextPage;
            this.el = nextPage;
            nextPage.focus();

            const range = document.createRange();
            if (caretNode && targetCaretEl.contains(caretNode)) {
              try {
                range.setStart(caretNode, Math.min(caretOffset, caretNode.length || 0));
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
              } catch {
                range.selectNodeContents(targetCaretEl);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            } else {
              range.selectNodeContents(targetCaretEl);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }

            nextPage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          if (body.children.length === 0) {
            body.innerHTML = '<p><br></p>';
          }
        }
      }
    } finally {
      this.isPaginating = false;
    }
  }

  handleBeforeInput(e) {
    if (this.mode !== 'suggesting') return;

    if (e.inputType === 'insertText' || e.inputType === 'insertCompositionText') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const anchorNode = sel.anchorNode;
      const anchorEl = anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
      const parentSug = anchorEl?.closest('.rta-suggestion-add');

      // If typing inside an existing suggestion addition, let browser insert naturally
      if (parentSug) return;

      e.preventDefault();
      const char = e.data || '';
      if (!char) return;

      const range = sel.getRangeAt(0);
      range.deleteContents();

      const id = 'sug-' + Math.random().toString(36).substr(2, 7);
      const span = document.createElement('span');
      span.className = 'rta-suggestion-mark rta-suggestion-add';
      span.setAttribute('data-id', id);
      span.setAttribute('data-author', this.options.user?.name || 'Author');
      span.setAttribute('data-author-color', this.options.user?.color || '#059669');
      span.textContent = char;
      range.insertNode(span);

      const newRange = document.createRange();
      newRange.setStart(span.firstChild || span, span.textContent.length);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      this.suggestions.push({
        id,
        type: 'add',
        text: char,
        quote: char,
        author: this.options.user?.name || 'Author',
        authorColor: this.options.user?.color || '#059669',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      this.renderGutterCards();
      this.handleInput();
      return;
    }

    if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      if (!sel.isCollapsed) {
        e.preventDefault();
        const range = sel.getRangeAt(0);
        const text = range.toString();
        if (!text || !text.trim()) {
          range.deleteContents();
          return;
        }

        const id = 'sug-' + Math.random().toString(36).substr(2, 7);
        const del = document.createElement('del');
        del.className = 'rta-suggestion-mark rta-suggestion-del';
        del.setAttribute('data-id', id);
        del.setAttribute('data-author', this.options.user?.name || 'Author');
        del.setAttribute('data-author-color', this.options.user?.color || '#dc2626');
        del.appendChild(range.extractContents());
        range.insertNode(del);

        const newRange = document.createRange();
        newRange.setStartAfter(del);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        this.suggestions.push({
          id,
          type: 'del',
          text,
          quote: text,
          author: this.options.user?.name || 'Author',
          authorColor: this.options.user?.color || '#dc2626',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        this.renderGutterCards();
        this.handleInput();
        return;
      }
    }
  }

  handleInput() {
    if (this.isComposing) return;

    // Sync active addition suggestions if text was typed directly inside them
    if (this.suggestions && this.suggestions.length > 0) {
      this.suggestions.forEach(sug => {
        if (sug.type === 'add') {
          const el = this.container?.querySelector(`.rta-suggestion-add[data-id="${sug.id}"]`);
          if (el) {
            const val = el.textContent || '';
            if (val !== sug.text) {
              sug.text = val;
              sug.quote = val;
              const cardQuote = this.cardsGutter?.querySelector(`.rta-gutter-card[data-id="${sug.id}"] .rta-card-quote`);
              if (cardQuote) cardQuote.textContent = `“${val}”`;
            }
          }
        }
      });
    }

    this.checkAutoPagination(this.contentArea);
    this.updateGutterPositions();
    this.recordSnapshot();
    this.emit('change', {
      html: this.getHTML(),
      text: this.getText(),
      stats: this.getStats()
    });
  }

  handleKeyDown(e) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;

    if (cmdKey) {
      const key = e.key.toLowerCase();
      if (e.altKey && key === 'm') {
        e.preventDefault();
        this.openCommentDraft();
        return;
      }
      if (key === 'b') {
        e.preventDefault();
        this.format('bold');
      } else if (key === 'i') {
        e.preventDefault();
        this.format('italic');
      } else if (key === 'u') {
        e.preventDefault();
        this.format('underline');
      } else if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      } else if (key === 'y') {
        e.preventDefault();
        this.redo();
      } else if (key === 's') {
        e.preventDefault();
        this.emit('save', {
          html: this.getHTML(),
          markdown: this.getMarkdown(),
          stats: this.getStats()
        });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        this.format('outdent');
      } else {
        this.format('indent');
      }
    } else if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed && this.isEditorFocused()) {
        const curPage = this.contentArea || sel.anchorNode?.closest?.('.rta-page-sheet');
        const pageIndex = this.pages.indexOf(curPage);
        if (pageIndex > 0) {
          const body = curPage?.querySelector('.rta-page-body');
          const firstChild = body?.firstElementChild;
          const range = sel.getRangeAt(0);
          const isAtStart = (
            range.startOffset === 0 &&
            (sel.anchorNode === firstChild || firstChild?.contains(sel.anchorNode) || sel.anchorNode === body)
          );

          if (isAtStart) {
            e.preventDefault();
            const prevPage = this.pages[pageIndex - 1];
            const prevBody = prevPage?.querySelector('.rta-page-body');
            const lastChild = prevBody?.lastElementChild || prevBody;

            const isEmptyPage = !body || body.textContent.trim() === '';
            if (isEmptyPage && this.pages.length > 1) {
              this.removePage(pageIndex + 1);
            }

            if (lastChild) {
              this.contentArea = prevPage;
              this.el = prevPage;
              prevPage.focus();
              const newRange = document.createRange();
              newRange.selectNodeContents(lastChild);
              newRange.collapse(false);
              sel.removeAllRanges();
              sel.addRange(newRange);
              prevPage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            this.handleInput();
            return;
          }
        }
      }
    } else if (e.key === 'Enter') {
      setTimeout(() => this.checkAutoPagination(this.contentArea), 0);
    }
  }

  handlePaste(e) {
    e.preventDefault();
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    if (this.mode === 'suggesting') {
      const text = clipboardData.getData('text/plain');
      if (text) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();

        const id = 'sug-' + Math.random().toString(36).substr(2, 7);
        const span = document.createElement('span');
        span.className = 'rta-suggestion-mark rta-suggestion-add';
        span.setAttribute('data-id', id);
        span.setAttribute('data-author', this.options.user?.name || 'Author');
        span.textContent = text;
        range.insertNode(span);

        const newRange = document.createRange();
        newRange.setStartAfter(span);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        this.suggestions.push({
          id,
          type: 'add',
          text,
          quote: text,
          author: this.options.user?.name || 'Author',
          authorColor: this.options.user?.color || '#059669',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        this.renderGutterCards();
        this.handleInput();
      }
      return;
    }

    const html = clipboardData.getData('text/html');
    const text = clipboardData.getData('text/plain');

    if (html) {
      const cleanHtml = sanitizeHtml(html);
      document.execCommand('insertHTML', false, cleanHtml);
    } else if (text) {
      document.execCommand('insertText', false, text);
    }
    this.handleInput();
  }

  exec(command, value = null) {
    return this.format(command, value);
  }

  async importDocument(file) {
    const html = await readDocumentFile(file);
    this.setHTML(html);
    return html;
  }

  format(command, value = null) {
    if (this.options.readOnly) return;
    this.focus();

    switch (command) {
      case 'heading':
        if (value && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(value.toLowerCase())) {
          document.execCommand('formatBlock', false, `<${value}>`);
        } else {
          document.execCommand('formatBlock', false, '<p>');
        }
        break;
      case 'paragraph':
        document.execCommand('formatBlock', false, '<p>');
        break;
      case 'blockquote':
        document.execCommand('formatBlock', false, '<blockquote>');
        break;
      case 'codeBlock':
        document.execCommand('formatBlock', false, '<pre>');
        break;
      case 'fontSize':
        this.setFontSize(value);
        break;
      case 'lineHeight':
        this.setLineHeight(value);
        break;
      case 'color':
        if (value) document.execCommand('foreColor', false, sanitizeColor(value));
        break;
      case 'highlight':
        if (value) document.execCommand('hiliteColor', false, sanitizeColor(value));
        break;
      case 'link':
        if (value) {
          const safe = sanitizeUrl(value);
          document.execCommand('createLink', false, safe);
        } else {
          document.execCommand('unlink', false, null);
        }
        break;
      case 'strikeThrough':
        document.execCommand('strikeThrough', false, null);
        break;
      case 'removeFormat':
        document.execCommand('removeFormat', false, null);
        break;
      case 'addPage':
      case 'pageBreak':
        this.insertPageBreak();
        break;
      default:
        document.execCommand(command, false, value);
        break;
    }

    this.handleInput();
  }

  insertPageBreak() {
    this.focus();
    const breakHtml = '<div class="rta-page-break" contenteditable="false"><div class="rta-page-break-line"></div><span class="rta-page-break-tag">📄 PAGE BREAK</span></div><p><br></p>';
    document.execCommand('insertHTML', false, breakHtml);
    this.handleInput();
  }

  setMode(mode) {
    this.mode = mode;
    if (!this.contentArea) return;

    const existingBanner = this.container?.querySelector('.rta-mode-banner');
    if (existingBanner) existingBanner.remove();

    const isReadOnly = (mode === 'viewing');
    if (this.pages && this.pages.length > 0) {
      this.pages.forEach(p => { p.contentEditable = !isReadOnly; });
    } else {
      this.contentArea.contentEditable = !isReadOnly;
    }

    if (mode === 'viewing') {
      const banner = document.createElement('div');
      banner.className = 'rta-mode-banner rta-banner-viewing';
      banner.innerHTML = '👁️ <strong>Viewing Mode:</strong> Document is read-only.';
      this.container?.insertBefore(banner, this.container.firstChild);
    } else if (mode === 'suggesting') {
      const banner = document.createElement('div');
      banner.className = 'rta-mode-banner rta-banner-suggesting';
      banner.innerHTML = '💡 <strong>Suggesting Mode:</strong> Edits appear in green/red as suggestions with cards in the right margin.';
      this.container?.insertBefore(banner, this.container.firstChild);
    } else if (mode === 'comments') {
      const banner = document.createElement('div');
      banner.className = 'rta-mode-banner';
      banner.style.backgroundColor = '#fef9c3';
      banner.style.color = '#854d0e';
      banner.style.borderColor = '#fde047';
      banner.innerHTML = '💬 <strong>Comments Mode:</strong> Select text to add a comment card beside that line.';
      this.container?.insertBefore(banner, this.container.firstChild);

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && this.isEditorFocused()) {
        this.openCommentDraft();
      }
    } else if (mode === 'version-history') {
      this.toggleVersionHistoryModal();
    } else if (mode === 'version-comparison') {
      this.toggleVersionComparisonModal();
    }

    this.renderGutterCards();
    this.emit('modeChange', mode);
  }

  getUsers() {
    return [...this.users];
  }

  getCurrentUser() {
    return this.options.user;
  }

  getUser(idOrName) {
    if (!idOrName) return null;
    return this.users.find(u => u.id === idOrName || u.name === idOrName) || null;
  }

  setUser(userOrId) {
    let found = null;
    if (typeof userOrId === 'string') {
      found = this.getUser(userOrId);
    } else if (userOrId && typeof userOrId === 'object') {
      found = this.getUser(userOrId.id) || this.getUser(userOrId.name);
      if (!found) {
        found = userOrId;
        this.users.push(found);
        this.emit('usersChange', this.users);
      }
    }

    if (found) {
      this.options.user = found;
      this.emit('userChange', found);
      return found;
    }
    return this.options.user;
  }

  addUser(name, color = null) {
    if (!name || !name.trim()) return null;
    const cleanName = name.trim();
    const existing = this.users.find(u => u.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      this.setUser(existing);
      return existing;
    }

    const palette = ['#2563eb', '#ec4899', '#10b981', '#06b6d4', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316'];
    const assignedColor = color || palette[this.users.length % palette.length];
    const newUser = {
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
      name: cleanName,
      color: assignedColor
    };

    this.users.push(newUser);
    this.emit('usersChange', this.users);
    this.setUser(newUser);
    return newUser;
  }

  promptAddUser() {
    let modal = document.getElementById('rta-add-user-modal');
    if (modal) modal.remove();

    const palette = ['#2563eb', '#ec4899', '#10b981', '#06b6d4', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316'];
    const defaultColor = palette[this.users.length % palette.length];

    modal = document.createElement('div');
    modal.id = 'rta-add-user-modal';
    modal.className = 'rta-modal-backdrop';
    modal.innerHTML = `
      <div class="rta-modal" style="max-width: 420px; width: 90%;">
        <div class="rta-modal-header" style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
          <h3 class="rta-modal-title" style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>👤</span> Add New Collaborator
          </h3>
          <button type="button" class="rta-modal-close" style="font-size: 18px; cursor: pointer; border: none; background: none; color: #64748b;" onclick="this.closest('.rta-modal-backdrop').remove()">✕</button>
        </div>
        <div class="rta-modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label for="rta-input-username" style="font-size: 12.5px; font-weight: 600; color: #334155;">
              User / Author Name:
            </label>
            <input type="text" id="rta-input-username" placeholder="e.g. Michael (Product Lead)" class="rta-input" style="height: 36px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none; width: 100%; box-sizing: border-box;" />
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 12.5px; font-weight: 600; color: #334155;">
              Author Color:
            </label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="color" id="rta-input-usercolor" value="${defaultColor}" style="width: 36px; height: 36px; padding: 0; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; background: none;" />
              <span style="font-size: 12px; color: #64748b;">Color used for cursor tooltip, comments, and highlights</span>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
            <button type="button" class="rta-btn" style="padding: 7px 14px; border: 1px solid #cbd5e1; border-radius: 6px; background: #ffffff; color: #475569; font-size: 12.5px; cursor: pointer;" onclick="this.closest('.rta-modal-backdrop').remove()">Cancel</button>
            <button type="button" id="rta-btn-confirm-add-user" style="padding: 7px 16px; border: none; border-radius: 6px; background: #6366f1; color: #ffffff; font-size: 12.5px; font-weight: 600; cursor: pointer;">Add & Select</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const inputName = modal.querySelector('#rta-input-username');
    const inputColor = modal.querySelector('#rta-input-usercolor');
    const confirmBtn = modal.querySelector('#rta-btn-confirm-add-user');

    setTimeout(() => inputName?.focus(), 50);

    const handleConfirm = () => {
      const name = inputName?.value?.trim();
      if (!name) {
        inputName?.focus();
        return;
      }
      const color = inputColor?.value || defaultColor;
      this.addUser(name, color);
      modal.remove();
    };

    confirmBtn?.addEventListener('click', handleConfirm);
    inputName?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    });
  }

  getAnnotationInfo(id, markEl) {
    if (!id && !markEl) return null;
    const targetId = id || markEl?.getAttribute('data-id') || markEl?.getAttribute('data-comment-id');

    // 1. Search in persistent comments
    if (targetId && this.comments) {
      const comment = this.comments.find(c => c.id === targetId);
      if (comment) {
        return {
          id: targetId,
          type: 'comment',
          author: comment.author || this.options.user?.name || 'Author',
          color: comment.authorColor || this.options.user?.color || '#2563eb',
          icon: '💬',
          label: 'Comment'
        };
      }
    }

    // 2. Active draft comment
    if (this.activeDraftComment && (!targetId || this.activeDraftComment.id === targetId)) {
      return {
        id: this.activeDraftComment.id,
        type: 'comment',
        author: this.options.user?.name || 'You',
        color: this.options.user?.color || '#2563eb',
        icon: '💬',
        label: 'Comment'
      };
    }

    // 3. Search in suggestions
    if (targetId && this.suggestions) {
      const suggestion = this.suggestions.find(s => s.id === targetId);
      if (suggestion) {
        const isDel = suggestion.type === 'del';
        return {
          id: targetId,
          type: 'suggestion',
          author: suggestion.author || this.options.user?.name || 'Author',
          color: suggestion.authorColor || (isDel ? '#dc2626' : '#059669'),
          icon: isDel ? '✂️' : '💡',
          label: isDel ? 'Deletion' : 'Addition'
        };
      }
    }

    // 4. Fallback to DOM attributes on mark element
    if (markEl) {
      const isComment = markEl.classList.contains('rta-comment-mark');
      const isDel = markEl.classList.contains('rta-suggestion-del');
      const author = markEl.getAttribute('data-author') || this.options.user?.name || 'Author';
      const color = markEl.getAttribute('data-author-color') || (isComment ? '#2563eb' : (isDel ? '#dc2626' : '#059669'));
      return {
        id: targetId,
        type: isComment ? 'comment' : 'suggestion',
        author,
        color,
        icon: isComment ? '💬' : (isDel ? '✂️' : '💡'),
        label: isComment ? 'Comment' : (isDel ? 'Deletion' : 'Addition')
      };
    }

    return null;
  }

  showAnnotationTooltip(markEl, id) {
    if (!markEl) return;
    const info = this.getAnnotationInfo(id, markEl);
    if (!info) return;

    if (!this.annotationTooltipEl) {
      this.annotationTooltipEl = document.createElement('div');
      this.annotationTooltipEl.className = 'rta-annotation-tooltip';
      document.body.appendChild(this.annotationTooltipEl);
    }

    const color = info.color || '#2563eb';
    this.annotationTooltipEl.style.backgroundColor = color;
    this.annotationTooltipEl.style.borderTopColor = color;
    this.annotationTooltipEl.innerHTML = `
      <span class="rta-annotation-tooltip-icon">${info.icon}</span>
      <span class="rta-annotation-tooltip-name">${escapeHtml(info.author)}</span>
    `;

    const rect = markEl.getBoundingClientRect();
    const top = window.scrollY + rect.top - 26;
    const left = window.scrollX + rect.left;

    this.annotationTooltipEl.style.top = `${Math.max(8, top)}px`;
    this.annotationTooltipEl.style.left = `${Math.max(8, left)}px`;
    this.annotationTooltipEl.classList.add('is-active');
  }

  hideAnnotationTooltip() {
    if (this.annotationTooltipEl) {
      this.annotationTooltipEl.classList.remove('is-active');
    }
  }

  bindGutterContainerEvents(gutterEl) {
    if (!gutterEl) return;

    // Hover card in gutter -> Highlight mark in document & SPREAD cluster
    gutterEl.addEventListener('mouseenter', (e) => {
      const card = e.target.closest('.rta-gutter-card');
      if (!card) return;

      if (this.clusterCollapseTimer) {
        clearTimeout(this.clusterCollapseTimer);
        this.clusterCollapseTimer = null;
      }

      const id = card.getAttribute('data-id');
      const clusterId = card.getAttribute('data-cluster-id');

      if (clusterId && this.activeHoveredCluster !== clusterId) {
        this.activeHoveredCluster = clusterId;
        this.updateGutterPositions();
      }

      if (id) {
        card.classList.add('is-hovered-card');
        const marks = this.container?.querySelectorAll(`[data-id="${id}"]`) || [];
        marks.forEach(m => m.classList.add('is-hovered-mark'));
        if (marks.length > 0) {
          this.showAnnotationTooltip(marks[0], id);
        }
      }
    }, true);

    gutterEl.addEventListener('mouseleave', (e) => {
      const related = e.relatedTarget;
      if (related && gutterEl.contains(related)) return;

      if (this.clusterCollapseTimer) {
        clearTimeout(this.clusterCollapseTimer);
      }

      // 280ms grace debounce so cursor can travel between cards in expanded group without flickering
      this.clusterCollapseTimer = setTimeout(() => {
        const hasActiveDraftFocus = this.container?.querySelector('.rta-card-textarea:focus');
        if (!hasActiveDraftFocus) {
          this.activeHoveredCluster = null;
        }

        const hoveredCards = this.container?.querySelectorAll('.is-hovered-card, .is-active-top-layer') || [];
        hoveredCards.forEach(c => c.classList.remove('is-hovered-card', 'is-active-top-layer'));
        this.hideAnnotationTooltip();
        this.updateGutterPositions();
      }, 280);
    }, true);

    // Click inside gutter cards (Actions & Scroll)
    gutterEl.addEventListener('click', (e) => {
      const card = e.target.closest('.rta-gutter-card');
      if (!card) return;

      const btn = e.target.closest('button');
      if (btn) {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action === 'acceptSuggestion') {
          this.acceptSuggestion(id);
        } else if (action === 'rejectSuggestion') {
          this.rejectSuggestion(id);
        } else if (action === 'resolveComment') {
          this.resolveComment(id);
        } else if (action === 'deleteComment') {
          this.deleteComment(id);
        } else if (action === 'submitDraftComment') {
          const textarea = card.querySelector('.rta-card-textarea');
          this.submitCommentDraft(textarea?.value);
        } else if (action === 'cancelDraftComment') {
          this.cancelCommentDraft();
        }
        return;
      }

      // Clicking card background smoothly scrolls mark into view
      const id = card.getAttribute('data-id');
      const mark = this.container?.querySelector(`[data-id="${id}"]`);
      if (mark) {
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Keyboard support in draft comment textarea
    gutterEl.addEventListener('keydown', (e) => {
      if (e.target.matches('.rta-card-textarea')) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          this.submitCommentDraft(e.target.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelCommentDraft();
        }
      }
    });
  }

  initGutterEvents() {
    if (!this.container) return;

    if (this.leftGutter) this.bindGutterContainerEvents(this.leftGutter);
    if (this.rightGutter) this.bindGutterContainerEvents(this.rightGutter);

    // Hover mark in document -> Highlight card in gutter & show author tooltip & bring to TOP LAYER
    this.container.addEventListener('mouseenter', (e) => {
      const mark = e.target.closest('.rta-comment-mark, .rta-suggestion-mark');
      if (!mark) return;
      const id = mark.getAttribute('data-id');
      if (!id) return;

      mark.classList.add('is-hovered-mark');
      this.showAnnotationTooltip(mark, id);
      const card = this.container.querySelector(`.rta-gutter-card[data-id="${id}"]`);
      if (card) {
        card.classList.add('is-hovered-card', 'is-active-top-layer');
        const authorColor = mark.getAttribute('data-author-color') || '#6366f1';
        card.style.setProperty('--card-color', authorColor);
        this.updateGutterPositions();
      }
    }, true);

    this.container.addEventListener('mouseleave', (e) => {
      const mark = e.target.closest('.rta-comment-mark, .rta-suggestion-mark');
      if (!mark) return;
      const id = mark.getAttribute('data-id');
      if (!id) return;

      mark.classList.remove('is-hovered-mark');
      this.hideAnnotationTooltip();
      const card = this.container.querySelector(`.rta-gutter-card[data-id="${id}"]`);
      if (card) {
        card.classList.remove('is-hovered-card', 'is-active-top-layer');
        this.updateGutterPositions();
      }
    }, true);
  }

  openCommentDraft() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !this.isEditorFocused()) {
      alert('Please select some text in the document first to add a comment.');
      return;
    }

    if (this.activeDraftComment) {
      this.cancelCommentDraft();
    }

    const range = sel.getRangeAt(0);
    const quote = range.toString().trim();
    if (!quote) return;

    const draftId = 'draft-' + Date.now();
    const mark = document.createElement('mark');
    mark.className = 'rta-comment-mark rta-comment-mark-draft';
    mark.setAttribute('data-id', draftId);
    mark.setAttribute('data-author', this.options.user?.name || 'Author');
    mark.setAttribute('data-author-color', this.options.user?.color || '#2563eb');

    try {
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    } catch (err) {
      console.warn('Could not wrap selection in draft comment mark:', err);
      return;
    }

    this.activeDraftComment = {
      id: draftId,
      quote,
      markElement: mark
    };

    this.renderGutterCards();

    // Auto-focus draft textarea
    setTimeout(() => {
      const textarea = this.cardsGutter?.querySelector(`.rta-gutter-card[data-id="${draftId}"] .rta-card-textarea`);
      textarea?.focus();
    }, 50);
  }

  cancelCommentDraft() {
    if (!this.activeDraftComment) return;
    const draftId = this.activeDraftComment.id;
    const mark = this.container?.querySelector(`.rta-comment-mark[data-id="${draftId}"]`);
    if (mark) {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      mark.remove();
    }
    this.activeDraftComment = null;
    this.renderGutterCards();
  }

  submitCommentDraft(text) {
    if (!this.activeDraftComment) return;
    if (!text || !text.trim()) {
      this.cancelCommentDraft();
      return;
    }

    const draftId = this.activeDraftComment.id;
    const permId = 'c-' + Date.now();
    const mark = this.container?.querySelector(`.rta-comment-mark[data-id="${draftId}"]`);
    if (mark) {
      mark.classList.remove('rta-comment-mark-draft');
      mark.setAttribute('data-id', permId);
      mark.setAttribute('data-comment-id', permId);
      mark.setAttribute('data-author', this.options.user?.name || 'Author');
      mark.setAttribute('data-author-color', this.options.user?.color || '#2563eb');
    }

    const newComment = {
      id: permId,
      text: text.trim(),
      quote: this.activeDraftComment.quote,
      author: this.options.user?.name || 'Author',
      authorColor: this.options.user?.color || '#2563eb',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.comments.push(newComment);
    this.activeDraftComment = null;
    this.renderGutterCards();
    this.handleInput();
    this.emit('commentAdded', newComment);
    this.emit('commentsChange', this.comments);
  }

  addComment(text) {
    if (!text || !text.trim()) return;
    const sel = window.getSelection();
    const quote = sel && sel.toString().trim() ? sel.toString().trim() : 'Document Selection';
    const id = 'c-' + Date.now();
    const comment = {
      id,
      text: text.trim(),
      quote,
      author: this.options.user?.name || 'Author',
      authorColor: this.options.user?.color || '#2563eb',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const mark = document.createElement('mark');
      mark.className = 'rta-comment-mark';
      mark.setAttribute('data-id', id);
      mark.setAttribute('data-comment-id', id);
      mark.setAttribute('data-author', comment.author);
      mark.setAttribute('data-author-color', comment.authorColor);
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    }

    this.comments.push(comment);
    this.renderGutterCards();
    this.handleInput();
    this.emit('commentAdded', comment);
    this.emit('commentsChange', this.comments);
  }

  resolveComment(id) {
    const mark = this.container?.querySelector(`.rta-comment-mark[data-id="${id}"]`);
    if (mark) {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      mark.remove();
    }
    this.comments = this.comments.filter(c => c.id !== id);
    this.renderGutterCards();
    this.handleInput();
    this.emit('commentResolved', id);
    this.emit('commentsChange', this.comments);
  }

  deleteComment(id) {
    this.resolveComment(id);
  }

  acceptSuggestion(id) {
    const itemIndex = this.suggestions.findIndex(s => s.id === id);
    if (itemIndex === -1) return;
    const sug = this.suggestions[itemIndex];
    const el = this.container?.querySelector(`[data-id="${id}"]`);

    if (el) {
      if (sug.type === 'add') {
        const parent = el.parentNode;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        el.remove();
      } else if (sug.type === 'del') {
        el.remove();
      }
    }

    this.suggestions.splice(itemIndex, 1);
    this.renderGutterCards();
    this.handleInput();
    this.emit('suggestionAccepted', sug);
  }

  rejectSuggestion(id) {
    const itemIndex = this.suggestions.findIndex(s => s.id === id);
    if (itemIndex === -1) return;
    const sug = this.suggestions[itemIndex];
    const el = this.container?.querySelector(`[data-id="${id}"]`);

    if (el) {
      if (sug.type === 'add') {
        el.remove();
      } else if (sug.type === 'del') {
        const parent = el.parentNode;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        el.remove();
      }
    }

    this.suggestions.splice(itemIndex, 1);
    this.renderGutterCards();
    this.handleInput();
    this.emit('suggestionRejected', sug);
  }

  renderGutterCards() {
    const cardsList = [];

    // 1. Suggestions Cards
    this.suggestions.forEach(sug => {
      const initial = (sug.author || 'A').charAt(0).toUpperCase();
      const color = sug.authorColor || (sug.type === 'add' ? '#16a34a' : '#dc2626');
      const badgeClass = sug.type === 'add' ? 'rta-badge-add' : 'rta-badge-del';
      const badgeText = sug.type === 'add' ? '+ Addition' : '- Deletion';
      const actionText = sug.type === 'add' ? 'Suggested inserting:' : 'Suggested deleting:';

      cardsList.push({
        id: sug.id,
        html: `
        <div class="rta-gutter-card" data-id="${sug.id}" data-type="suggestion">
          <div class="rta-card-header">
            <div class="rta-card-user">
              <span class="rta-card-avatar" style="background-color: ${color}">${initial}</span>
              <div class="rta-card-user-info">
                <span class="rta-card-author">${escapeHtml(sug.author)}</span>
                <span class="rta-card-time">${sug.timestamp}</span>
              </div>
            </div>
            <span class="rta-card-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="rta-card-quote">“${escapeHtml(sug.quote || sug.text)}”</div>
          <div class="rta-card-body-text" style="font-size:11.5px; color:#64748b;">${actionText}</div>
          <div class="rta-card-actions">
            <button type="button" class="rta-btn-card-accept" data-action="acceptSuggestion" data-id="${sug.id}" title="Accept suggestion">✓ Accept</button>
            <button type="button" class="rta-btn-card-reject" data-action="rejectSuggestion" data-id="${sug.id}" title="Reject suggestion">✕ Reject</button>
          </div>
        </div>
      `
      });
    });

    // 2. Comments Cards
    this.comments.forEach(c => {
      const initial = (c.author || 'A').charAt(0).toUpperCase();
      const color = c.authorColor || '#2563eb';

      cardsList.push({
        id: c.id,
        html: `
        <div class="rta-gutter-card" data-id="${c.id}" data-type="comment">
          <div class="rta-card-header">
            <div class="rta-card-user">
              <span class="rta-card-avatar" style="background-color: ${color}">${initial}</span>
              <div class="rta-card-user-info">
                <span class="rta-card-author">${escapeHtml(c.author)}</span>
                <span class="rta-card-time">${c.timestamp}</span>
              </div>
            </div>
            <span class="rta-card-badge rta-badge-comment">💬 Comment</span>
          </div>
          ${c.quote ? `<div class="rta-card-quote">“${escapeHtml(c.quote)}”</div>` : ''}
          <div class="rta-card-body-text">${escapeHtml(c.text)}</div>
          <div class="rta-card-actions">
            <button type="button" class="rta-btn-card-resolve" data-action="resolveComment" data-id="${c.id}" title="Resolve comment">✓ Resolve</button>
            <button type="button" class="rta-btn-card-delete" data-action="deleteComment" data-id="${c.id}" title="Delete comment">🗑️</button>
          </div>
        </div>
      `
      });
    });

    // 3. Draft Comment Card (if active)
    if (this.activeDraftComment) {
      const d = this.activeDraftComment;
      const author = this.options.user?.name || 'Author';
      const initial = author.charAt(0).toUpperCase();
      const color = this.options.user?.color || '#6366f1';

      cardsList.push({
        id: d.id,
        html: `
        <div class="rta-gutter-card rta-card-draft" data-id="${d.id}" data-type="draft-comment">
          <div class="rta-card-header">
            <div class="rta-card-user">
              <span class="rta-card-avatar" style="background-color: ${color}">${initial}</span>
              <div class="rta-card-user-info">
                <span class="rta-card-author">${escapeHtml(author)}</span>
                <span class="rta-card-time">Draft</span>
              </div>
            </div>
            <span class="rta-card-badge rta-badge-comment">💬 Comment</span>
          </div>
          <div class="rta-card-quote">“${escapeHtml(d.quote)}”</div>
          <textarea class="rta-card-textarea" placeholder="Add a comment... (Ctrl+Enter to post)"></textarea>
          <div class="rta-card-actions">
            <button type="button" class="rta-btn-card-submit" data-action="submitDraftComment" data-id="${d.id}">Comment</button>
            <button type="button" class="rta-btn-card-cancel" data-action="cancelDraftComment" data-id="${d.id}">Cancel</button>
          </div>
        </div>
      `
      });
    }

    if (!this.leftGutter && !this.rightGutter) {
      if (this.cardsGutter) {
        this.cardsGutter.innerHTML = cardsList.map(c => c.html).join('');
        this.updateGutterPositionsForGutter(this.cardsGutter);
      }
      return;
    }

    const pos = this.options.gutterPosition || 'right';

    if (pos === 'left') {
      if (this.leftGutter) {
        this.leftGutter.style.display = 'block';
        this.leftGutter.innerHTML = cardsList.map(c => c.html).join('');
      }
      if (this.rightGutter) {
        this.rightGutter.style.display = 'none';
        this.rightGutter.innerHTML = '';
      }
      this.cardsGutter = this.leftGutter;
      this.updateGutterPositionsForGutter(this.leftGutter);
    } else if (pos === 'right') {
      if (this.leftGutter) {
        this.leftGutter.style.display = 'none';
        this.leftGutter.innerHTML = '';
      }
      if (this.rightGutter) {
        this.rightGutter.style.display = 'block';
        this.rightGutter.innerHTML = cardsList.map(c => c.html).join('');
      }
      this.cardsGutter = this.rightGutter;
      this.updateGutterPositionsForGutter(this.rightGutter);
    } else {
      // BOTH SIDES: Auto Bilateral Arrangement
      if (this.leftGutter) this.leftGutter.style.display = 'block';
      if (this.rightGutter) this.rightGutter.style.display = 'block';

      const { leftCards, rightCards } = this.partitionCardsBilateral(cardsList);
      if (this.leftGutter) this.leftGutter.innerHTML = leftCards.map(c => c.html).join('');
      if (this.rightGutter) this.rightGutter.innerHTML = rightCards.map(c => c.html).join('');

      this.cardsGutter = this.rightGutter;
      if (this.leftGutter) this.updateGutterPositionsForGutter(this.leftGutter);
      if (this.rightGutter) this.updateGutterPositionsForGutter(this.rightGutter);
    }
  }

  partitionCardsBilateral(cardsList) {
    if (!cardsList || cardsList.length === 0) {
      return { leftCards: [], rightCards: [] };
    }

    const shellRect = this.container?.getBoundingClientRect() || { top: 0, left: 0, width: 1000 };
    const midX = (shellRect.width || 1000) / 2;

    const itemsWithPos = cardsList.map(item => {
      const mark = this.container?.querySelector(`[data-id="${item.id}"]`);
      let top = 20;
      let left = midX + 10;
      if (mark) {
        const rect = mark.getBoundingClientRect();
        top = (rect.top - shellRect.top) + (this.container?.scrollTop || 0);
        left = rect.left - shellRect.left;
      }
      return { ...item, targetTop: top, targetLeft: left };
    });

    itemsWithPos.sort((a, b) => a.targetTop - b.targetTop);

    // Group into 50px vertical line bands
    const bands = [];
    let curBand = null;

    for (const item of itemsWithPos) {
      if (!curBand || (item.targetTop - curBand.anchorTop) > 50) {
        curBand = { anchorTop: item.targetTop, items: [item] };
        bands.push(curBand);
      } else {
        curBand.items.push(item);
      }
    }

    const leftCards = [];
    const rightCards = [];

    for (const band of bands) {
      const count = band.items.length;
      if (count === 1) {
        const it = band.items[0];
        if (it.targetLeft < midX) {
          leftCards.push(it);
        } else {
          rightCards.push(it);
        }
      } else if (count === 2) {
        // 2 items: 1 occupies left, 1 occupies right!
        const it1 = band.items[0];
        const it2 = band.items[1];
        if (it1.targetLeft <= it2.targetLeft) {
          leftCards.push(it1);
          rightCards.push(it2);
        } else {
          leftCards.push(it2);
          rightCards.push(it1);
        }
      } else {
        // 3+ items: distribute alternatingly so clusters stay evenly balanced on left & right
        band.items.forEach((it, idx) => {
          if (idx % 2 === 0) {
            rightCards.push(it);
          } else {
            leftCards.push(it);
          }
        });
      }
    }

    return { leftCards, rightCards };
  }

  updateGutterPositionsForGutter(gutter) {
    if (!gutter || !this.container) return;
    const cards = Array.from(gutter.querySelectorAll('.rta-gutter-card'));
    if (cards.length === 0) return;

    const shellRect = this.container.getBoundingClientRect();
    const cardData = [];

    for (const card of cards) {
      const id = card.getAttribute('data-id');
      const mark = this.container.querySelector(`[data-id="${id}"]`);
      if (mark) {
        const markRect = mark.getBoundingClientRect();
        const targetTop = (markRect.top - shellRect.top) + this.container.scrollTop;
        cardData.push({ card, targetTop, id });
      } else {
        cardData.push({ card, targetTop: parseFloat(card.style.top) || 20, id });
      }
    }

    cardData.sort((a, b) => a.targetTop - b.targetTop);

    const side = gutter.getAttribute('data-gutter-side') || 'r';
    const clusters = [];
    let curCluster = null;

    for (const item of cardData) {
      if (!curCluster || (item.targetTop - curCluster.anchorTop) > 50) {
        curCluster = {
          id: `cluster-${side}-${clusters.length}`,
          anchorTop: item.targetTop,
          items: [item]
        };
        clusters.push(curCluster);
      } else {
        curCluster.items.push(item);
      }
    }

    let currentTop = 20;

    for (let c = 0; c < clusters.length; c++) {
      const cluster = clusters[c];
      const baseTop = Math.max(cluster.anchorTop, currentTop);
      const isMulti = cluster.items.length > 1;
      const isSpread = isMulti && (this.activeHoveredCluster === cluster.id || cluster.items.some(it => it.card.querySelector('.rta-card-textarea:focus')));

      if (!isMulti) {
        const item = cluster.items[0];
        item.card.removeAttribute('data-cluster-id');
        item.card.classList.remove('is-in-cluster', 'is-cluster-stacked', 'is-cluster-spread');
        const badge = item.card.querySelector('.rta-cluster-badge');
        if (badge) badge.remove();

        item.card.style.top = `${baseTop}px`;
        if (!item.card.classList.contains('is-active-top-layer')) {
          item.card.style.transform = '';
          item.card.style.zIndex = '10';
          item.card.style.opacity = '1';
        }
        const cardH = Math.max(90, item.card.getBoundingClientRect().height || item.card.offsetHeight || 120);
        currentTop = baseTop + cardH + 14;
      } else {
        // Multi-card stack / cluster
        let spreadAccumulator = baseTop;

        for (let idx = 0; idx < cluster.items.length; idx++) {
          const item = cluster.items[idx];
          item.card.setAttribute('data-cluster-id', cluster.id);
          item.card.classList.add('is-in-cluster');

          let badge = item.card.querySelector('.rta-cluster-badge');
          if (idx === 0) {
            if (!badge) {
              badge = document.createElement('div');
              badge.className = 'rta-cluster-badge';
              item.card.insertBefore(badge, item.card.firstChild);
            }
            badge.innerHTML = isSpread
              ? `<span>📚 Line Group (${cluster.items.length})</span> <span style="font-size:10px; opacity:0.8; margin-left:auto;">Expanded</span>`
              : `<span>📚 ${cluster.items.length} items on this line</span> <span style="font-size:10px; opacity:0.8; margin-left:auto;">Hover to spread ▾</span>`;
          } else if (badge) {
            badge.remove();
          }

          if (isSpread) {
            // SPREAD STATE: Accumulate exact rendered heights with a clean 12px gap!
            item.card.classList.remove('is-cluster-stacked');
            item.card.classList.add('is-cluster-spread');
            item.card.style.top = `${spreadAccumulator}px`;
            if (!item.card.classList.contains('is-active-top-layer')) {
              item.card.style.transform = 'none';
              item.card.style.zIndex = `${100 + idx}`;
              item.card.style.opacity = '1';
            }
            const measuredH = Math.max(90, item.card.getBoundingClientRect().height || item.card.offsetHeight || 120);
            spreadAccumulator += measuredH + 12;
          } else {
            // STACKED STATE: 3D deck layering
            item.card.classList.remove('is-cluster-spread');
            item.card.classList.add('is-cluster-stacked');
            item.card.style.top = `${baseTop}px`;

            if (item.card.classList.contains('is-active-top-layer')) {
              item.card.style.transform = 'translateY(-4px) scale(1.025)';
              item.card.style.zIndex = '300';
              item.card.style.opacity = '1';
            } else {
              const offset = Math.min(idx * 7, 21);
              const scale = 1 - (idx * 0.03);
              item.card.style.transform = `translateY(${offset}px) scale(${scale})`;
              item.card.style.zIndex = `${30 - idx}`;
              item.card.style.opacity = idx === 0 ? '1' : `${Math.max(0.65, 0.95 - (idx * 0.12))}`;
            }
          }
        }

        if (isSpread) {
          currentTop = spreadAccumulator + 14;
        } else {
          const frontH = Math.max(90, cluster.items[0].card.getBoundingClientRect().height || cluster.items[0].card.offsetHeight || 120);
          currentTop = baseTop + frontH + 26;
        }
      }
    }
  }

  updateGutterPositions() {
    const pos = this.options.gutterPosition || 'right';
    if (pos === 'left') {
      if (this.leftGutter) this.updateGutterPositionsForGutter(this.leftGutter);
    } else if (pos === 'right') {
      if (this.rightGutter) this.updateGutterPositionsForGutter(this.rightGutter);
    } else {
      if (this.leftGutter) this.updateGutterPositionsForGutter(this.leftGutter);
      if (this.rightGutter) this.updateGutterPositionsForGutter(this.rightGutter);
    }
  }

  setGutterPosition(position) {
    const pos = (position === 'left' || position === 'both') ? position : 'right';
    this.options.gutterPosition = pos;
    if (this.container) {
      this.container.setAttribute('data-gutter-position', pos);
    }
    this.renderGutterCards();
    this.emit('gutterPositionChange', pos);
    return pos;
  }

  getGutterPosition() {
    return this.options.gutterPosition || 'right';
  }

  toggleGutterPosition() {
    const current = this.getGutterPosition();
    const next = current === 'right' ? 'left' : (current === 'left' ? 'both' : 'right');
    return this.setGutterPosition(next);
  }

  saveVersionSnapshot(title = null) {
    const stats = this.getStats();
    const ver = {
      id: 'ver-' + Date.now(),
      title: title || `Revision (${this.versions.length + 1})`,
      html: this.getHTML(),
      timestamp: new Date().toLocaleTimeString(),
      author: this.options.user?.name || 'Author',
      words: stats.words
    };
    this.versions.push(ver);
    this.emit('versionSaved', ver);
    return ver;
  }

  restoreVersion(id) {
    const ver = this.versions.find(v => v.id === id);
    if (ver) {
      this.setHTML(ver.html);
      alert(`Restored document to: ${ver.title} (${ver.timestamp})`);
    }
  }

  toggleVersionHistoryModal() {
    let modal = document.getElementById('rta-version-modal');
    if (modal) {
      modal.remove();
      return;
    }

    const stats = this.getStats();
    const defaultTitle = `Checkpoint ${this.versions.length + 1} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;

    modal = document.createElement('div');
    modal.id = 'rta-version-modal';
    modal.className = 'rta-modal-backdrop';
    modal.innerHTML = `
      <div class="rta-modal rta-modal-lg">
        <div class="rta-modal-header">
          <h3 class="rta-modal-title">🕒 Document Version History & Checkpoints</h3>
          <button type="button" class="rta-modal-close" onclick="this.closest('.rta-modal-backdrop').remove()">✕</button>
        </div>
        <div class="rta-modal-body">
          <!-- Save Current Document as New Version Card -->
          <div class="rta-version-create-card">
            <h4 class="rta-version-create-title">
              <span>💾 Save Current Document as New Version</span>
              <span style="font-weight:400; font-size:11.5px; color:#64748b; margin-left:auto;">${stats.words} words &bull; ${stats.chars} chars</span>
            </h4>
            <div class="rta-version-input-row">
              <input type="text" id="rta-version-title-input" class="rta-version-name-input" placeholder="Version name (e.g. Draft v2, Client Feedback, Final Review)" value="${escapeHtml(defaultTitle)}" />
              <button type="button" id="rta-btn-save-checkpoint" class="rta-btn-save-checkpoint">
                💾 Save Checkpoint
              </button>
            </div>
          </div>

          <!-- Audit Timeline List -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-size:12.5px; font-weight:600; color:#475569;">Saved Checkpoints Timeline (${this.versions.length}):</span>
            <span style="font-size:11.5px; color:#94a3b8;">Click Restore to rollback document state</span>
          </div>

          <div class="rta-version-list" id="rta-version-list">
            ${[...this.versions].reverse().map((v, idx) => {
              const isLatest = (idx === 0);
              const initial = (v.author || 'A').charAt(0).toUpperCase();
              return `
                <div class="rta-version-item ${isLatest ? 'is-current-version' : ''}" data-id="${v.id}">
                  <div class="rta-version-meta-left">
                    <span class="rta-version-avatar" style="background-color: ${isLatest ? '#16a34a' : '#6366f1'}">${initial}</span>
                    <div class="rta-version-details">
                      <div class="rta-version-title-row">
                        <span class="rta-version-title">${escapeHtml(v.title)}</span>
                        ${isLatest ? '<span class="rta-version-badge-live">● CURRENT LIVE</span>' : ''}
                      </div>
                      <div class="rta-version-sub">
                        By <strong>${escapeHtml(v.author)}</strong> &bull; ${v.timestamp} &bull; ${v.words || 0} words
                      </div>
                    </div>
                  </div>
                  <div class="rta-version-actions">
                    <button type="button" class="rta-btn-diff" data-id="${v.id}" title="Compare with current live document">⚖️ Diff</button>
                    <button type="button" class="rta-btn-restore" data-id="${v.id}" title="Rollback document to this checkpoint">↺ Restore</button>
                    ${this.versions.length > 1 && !isLatest ? `<button type="button" class="rta-btn-del-ver" data-id="${v.id}" title="Remove checkpoint">✕</button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#rta-version-title-input');
    const saveBtn = modal.querySelector('#rta-btn-save-checkpoint');

    const handleSave = () => {
      const title = input?.value?.trim() || defaultTitle;
      this.saveVersionSnapshot(title);
      modal.remove();
      this.toggleVersionHistoryModal();
    };

    saveBtn?.addEventListener('click', handleSave);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    });

    modal.querySelectorAll('.rta-btn-restore').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.restoreVersion(id);
        modal.remove();
      });
    });

    modal.querySelectorAll('.rta-btn-diff').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        modal.remove();
        this.toggleVersionComparisonModal(id);
      });
    });

    modal.querySelectorAll('.rta-btn-del-ver').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.versions = this.versions.filter(v => v.id !== id);
        modal.remove();
        this.toggleVersionHistoryModal();
      });
    });
  }

  toggleVersionComparisonModal(compareVerId = null) {
    let modal = document.getElementById('rta-compare-modal');
    if (modal) modal.remove();

    if (!this.versions || this.versions.length === 0) {
      this.saveVersionSnapshot('Initial Checkpoint');
    }

    // Default left version: compareVerId or latest prior checkpoint
    let targetLeftId = compareVerId;
    if (!targetLeftId) {
      targetLeftId = this.versions.length > 1 
        ? this.versions[this.versions.length - 2].id 
        : this.versions[0].id;
    }

    let targetRightId = 'live';
    let currentViewMode = 'split'; // 'split' | 'unified'

    const getVersionData = (id) => {
      if (id === 'live') {
        const stats = this.getStats();
        return {
          id: 'live',
          title: 'Current Live Document',
          html: this.getHTML(),
          timestamp: 'Live Now',
          author: this.options.user?.name || 'You',
          words: stats.words,
          isLive: true
        };
      }
      return this.versions.find(v => v.id === id) || this.versions[0];
    };

    let verLeft = getVersionData(targetLeftId);
    let verRight = getVersionData(targetRightId);

    modal = document.createElement('div');
    modal.id = 'rta-compare-modal';
    modal.className = 'rta-modal-backdrop';
    modal.innerHTML = `
      <div class="rta-modal rta-modal-xl">
        <div class="rta-modal-header" style="background:#ffffff; border-bottom:1px solid #e2e8f0; padding:12px 20px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:30px; height:30px; border-radius:6px; background:#f0fdf4; border:1px solid #bbf7d0; display:flex; align-items:center; justify-content:center; font-size:16px;">
              ⚖️
            </div>
            <div>
              <h3 class="rta-modal-title" style="font-size:15px; font-weight:700; color:#0f172a; margin:0; line-height:1.2;">
                Version Comparison & Diff Visualizer
              </h3>
              <p style="margin:2px 0 0; font-size:11.5px; color:#64748b; line-height:1.2;">
                Inspect changes word-by-word with color highlights (<span style="color:#15803d; font-weight:600;">+Green = Added</span>, <span style="color:#dc2626; font-weight:600;">-Red = Removed</span>).
              </p>
            </div>
          </div>
          <button type="button" class="rta-modal-close" style="font-size:18px; width:30px; height:30px; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="this.closest('.rta-modal-backdrop').remove()">✕</button>
        </div>

        <div class="rta-modal-body" style="display:flex; flex-direction:column; gap:10px; padding:12px 20px; background:#ffffff; overflow:hidden; flex:1; min-height:0;">
          <!-- Top Unified Control Toolbar -->
          <div class="rta-compare-toolbar">
            <!-- Left: Checkpoint Selectors -->
            <div class="rta-toolbar-group">
              <div class="rta-toolbar-field">
                <span class="rta-toolbar-label">From:</span>
                <select id="rta-compare-select-left" class="rta-toolbar-select">
                  ${[...this.versions].reverse().map(v => `
                    <option value="${v.id}" ${v.id === verLeft.id ? 'selected' : ''}>
                      ${escapeHtml(v.title)} (${v.timestamp} • ${v.words || 0}w)
                    </option>
                  `).join('')}
                </select>
              </div>

              <button type="button" id="rta-btn-swap-versions" class="rta-toolbar-btn" title="Swap versions">
                ⇄
              </button>

              <div class="rta-toolbar-field">
                <span class="rta-toolbar-label">To:</span>
                <select id="rta-compare-select-right" class="rta-toolbar-select">
                  <option value="live" ${targetRightId === 'live' ? 'selected' : ''}>
                    ● Live Document (Active)
                  </option>
                  ${[...this.versions].reverse().map(v => `
                    <option value="${v.id}" ${v.id === targetRightId ? 'selected' : ''}>
                      ${escapeHtml(v.title)} (${v.timestamp} • ${v.words || 0}w)
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="rta-toolbar-divider"></div>

            <!-- Center: View Mode Toggle -->
            <div class="rta-toolbar-group">
              <div class="rta-diff-view-toggle">
                <button type="button" class="rta-diff-toggle-btn is-active" id="rta-toggle-split">⧉ Side-by-Side</button>
                <button type="button" class="rta-diff-toggle-btn" id="rta-toggle-unified">☰ Unified</button>
              </div>
            </div>

            <div class="rta-toolbar-divider"></div>

            <!-- Right: Stats, Legend & Restore Action -->
            <div class="rta-toolbar-group" style="margin-left:auto;">
              <div id="rta-diff-stats-container" style="display:flex; align-items:center; gap:6px;">
                <!-- Dynamically populated stats pills -->
              </div>

              <div class="rta-diff-legend" style="padding:3px 8px;">
                <div class="rta-diff-legend-item">
                  <div class="rta-diff-legend-dot" style="background:#15803d; border:1px solid #16a34a;"></div>
                  <span>Added</span>
                </div>
                <div class="rta-diff-legend-item">
                  <div class="rta-diff-legend-dot" style="background:#dc2626; border:1px solid #ef4444;"></div>
                  <span>Removed</span>
                </div>
              </div>

              <button type="button" class="rta-btn-restore-toolbar" id="rta-btn-restore-diff-ver">
                ↺ Restore
              </button>
            </div>
          </div>

          <!-- Empty Identical Banner (Hidden by default) -->
          <div id="rta-diff-identical-banner" class="rta-diff-empty-banner" style="display:none; margin:0; padding:8px 14px; flex-shrink:0;">
            ✨ Both selected versions are identical — zero differences detected.
          </div>

          <!-- Split View Panes (Default) -->
          <div id="rta-diff-split-container" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; flex:1; min-height:0; overflow:hidden;">
            <!-- Left Pane (Baseline: deletions highlighted in red) -->
            <div style="display:flex; flex-direction:column; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff; box-shadow:0 1px 2px rgba(0,0,0,0.03); overflow:hidden; min-height:0;">
              <div id="rta-compare-header-left" style="padding:8px 14px; background:#fafbfd; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                <span style="font-size:12px; font-weight:700; color:#334155; display:flex; align-items:center; gap:6px;" id="rta-compare-title-left">
                  📑 Checkpoint: ${escapeHtml(verLeft.title)}
                </span>
                <span style="font-size:11px; color:#64748b;" id="rta-compare-meta-left">
                  By ${escapeHtml(verLeft.author || 'Author')} • ${verLeft.timestamp}
                </span>
              </div>
              <div class="rta-diff-pane" id="rta-compare-body-left">
                <!-- Injected Left Diff -->
              </div>
            </div>

            <!-- Right Pane (Target: additions highlighted in green) -->
            <div style="display:flex; flex-direction:column; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff; box-shadow:0 1px 2px rgba(0,0,0,0.03); overflow:hidden; min-height:0;">
              <div id="rta-compare-header-right" style="padding:8px 14px; background:#fafbfd; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                <span style="font-size:12px; font-weight:700; color:#166534; display:flex; align-items:center; gap:6px;" id="rta-compare-title-right">
                  ● ${escapeHtml(verRight.title)}
                </span>
                <span style="font-size:11px; color:#15803d;" id="rta-compare-meta-right">
                  By ${escapeHtml(verRight.author || 'Author')} • ${verRight.timestamp}
                </span>
              </div>
              <div class="rta-diff-pane" id="rta-compare-body-right">
                <!-- Injected Right Diff -->
              </div>
            </div>
          </div>

          <!-- Unified View Pane (Hidden initially) -->
          <div id="rta-diff-unified-container" style="display:none; flex-direction:column; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff; box-shadow:0 1px 2px rgba(0,0,0,0.03); overflow:hidden; flex:1; min-height:0;">
            <div style="padding:8px 14px; background:#fafbfd; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
              <span style="font-size:12px; font-weight:700; color:#334155;">
                📜 Unified Inline Diff (Additions in Green, Deletions in Red)
              </span>
              <span style="font-size:11px; color:#64748b;" id="rta-compare-meta-unified">
                Merged inspection view
              </span>
            </div>
            <div class="rta-diff-pane" id="rta-compare-body-unified">
              <!-- Injected Unified Diff -->
            </div>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const selectLeft = modal.querySelector('#rta-compare-select-left');
    const selectRight = modal.querySelector('#rta-compare-select-right');
    const swapBtn = modal.querySelector('#rta-btn-swap-versions');
    const titleLeft = modal.querySelector('#rta-compare-title-left');
    const metaLeft = modal.querySelector('#rta-compare-meta-left');
    const bodyLeft = modal.querySelector('#rta-compare-body-left');
    const titleRight = modal.querySelector('#rta-compare-title-right');
    const metaRight = modal.querySelector('#rta-compare-meta-right');
    const bodyRight = modal.querySelector('#rta-compare-body-right');
    const bodyUnified = modal.querySelector('#rta-compare-body-unified');
    const statsContainer = modal.querySelector('#rta-diff-stats-container');
    const identicalBanner = modal.querySelector('#rta-diff-identical-banner');
    const splitContainer = modal.querySelector('#rta-diff-split-container');
    const unifiedContainer = modal.querySelector('#rta-diff-unified-container');
    const toggleSplit = modal.querySelector('#rta-toggle-split');
    const toggleUnified = modal.querySelector('#rta-toggle-unified');
    const restoreBtn = modal.querySelector('#rta-btn-restore-diff-ver');

    const updatePanes = () => {
      verLeft = getVersionData(selectLeft.value);
      verRight = getVersionData(selectRight.value);

      // Compute word-level and block-level visual diff
      const diffResult = computeDocumentDiff(verLeft.html, verRight.html);

      // Update Left Pane
      titleLeft.innerHTML = `📑 Checkpoint: ${escapeHtml(verLeft.title)}`;
      metaLeft.textContent = `By ${verLeft.author || 'Author'} • ${verLeft.timestamp} • ${verLeft.words || 0}w`;
      bodyLeft.innerHTML = diffResult.leftHtml;

      // Update Right Pane
      titleRight.innerHTML = `${verRight.isLive ? '● Live: ' : '⚖️ Checkpoint: '}${escapeHtml(verRight.title)}`;
      metaRight.textContent = `By ${verRight.author || 'Author'} • ${verRight.timestamp} • ${verRight.words || 0}w`;
      bodyRight.innerHTML = diffResult.rightHtml;

      // Update Unified Pane
      bodyUnified.innerHTML = diffResult.unifiedHtml;

      // Update Diff Stats Pills
      statsContainer.innerHTML = `
        <span class="rta-diff-stat-pill rta-diff-stat-add" title="${diffResult.stats.additions} added words">
          +${diffResult.stats.additions} additions
        </span>
        <span class="rta-diff-stat-pill rta-diff-stat-del" title="${diffResult.stats.deletions} removed words">
          -${diffResult.stats.deletions} deletions
        </span>
        <span class="rta-diff-stat-pill rta-diff-stat-neutral" title="${diffResult.stats.unchanged} unchanged words">
          ${diffResult.stats.unchanged} unchanged
        </span>
      `;

      // Show identical banner if 0 differences
      if (diffResult.stats.totalChanges === 0) {
        identicalBanner.style.display = 'flex';
      } else {
        identicalBanner.style.display = 'none';
      }

      restoreBtn.textContent = `↺ Restore "${verLeft.title}"`;
    };

    selectLeft?.addEventListener('change', updatePanes);
    selectRight?.addEventListener('change', updatePanes);

    swapBtn?.addEventListener('click', () => {
      const curLeft = selectLeft.value;
      const curRight = selectRight.value;
      if (curRight !== 'live') {
        selectLeft.value = curRight;
      }
      selectRight.value = curLeft;
      updatePanes();
    });

    toggleSplit?.addEventListener('click', () => {
      currentViewMode = 'split';
      toggleSplit.classList.add('is-active');
      toggleUnified.classList.remove('is-active');
      splitContainer.style.display = 'grid';
      unifiedContainer.style.display = 'none';
    });

    toggleUnified?.addEventListener('click', () => {
      currentViewMode = 'unified';
      toggleUnified.classList.add('is-active');
      toggleSplit.classList.remove('is-active');
      splitContainer.style.display = 'none';
      unifiedContainer.style.display = 'flex';
    });

    // Synchronized scrolling for Side-by-Side panes
    let isSyncing = false;
    bodyLeft?.addEventListener('scroll', () => {
      if (isSyncing || currentViewMode !== 'split') return;
      isSyncing = true;
      const maxL = bodyLeft.scrollHeight - bodyLeft.clientHeight;
      const pct = maxL > 0 ? bodyLeft.scrollTop / maxL : 0;
      const maxR = bodyRight.scrollHeight - bodyRight.clientHeight;
      bodyRight.scrollTop = pct * maxR;
      setTimeout(() => { isSyncing = false; }, 30);
    });
    bodyRight?.addEventListener('scroll', () => {
      if (isSyncing || currentViewMode !== 'split') return;
      isSyncing = true;
      const maxR = bodyRight.scrollHeight - bodyRight.clientHeight;
      const pct = maxR > 0 ? bodyRight.scrollTop / maxR : 0;
      const maxL = bodyLeft.scrollHeight - bodyLeft.clientHeight;
      bodyLeft.scrollTop = pct * maxL;
      setTimeout(() => { isSyncing = false; }, 30);
    });

    restoreBtn?.addEventListener('click', () => {
      if (verLeft && verLeft.id !== 'live') {
        this.restoreVersion(verLeft.id);
        modal.remove();
      } else {
        alert('Please select a saved checkpoint from the left dropdown to restore.');
      }
    });

    // Initial Diff Render
    updatePanes();
  }

  setFontSize(px) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    const range = sel.getRangeAt(0);
    span.appendChild(range.extractContents());
    range.insertNode(span);
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
  }

  setLineHeight(val) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node = sel.anchorNode;
    while (node && node !== this.contentArea) {
      if (node.nodeType === Node.ELEMENT_NODE && ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(node.nodeName)) {
        node.style.lineHeight = val;
        break;
      }
      node = node.parentNode;
    }
  }

  insertTable(rows = 3, cols = 3) {
    this.focus();
    const numRows = Math.max(1, Math.min(100, parseInt(rows, 10) || 3));
    const numCols = Math.max(1, Math.min(50, parseInt(cols, 10) || 3));

    let tableHtml = '<div class="rta-table-wrap"><table class="rta-table"><thead><tr>';
    for (let c = 0; c < numCols; c++) {
      tableHtml += `<th>Header ${c + 1}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';

    for (let r = 1; r < numRows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < numCols; c++) {
        tableHtml += `<td>Cell ${r},${c + 1}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table></div><p><br></p>';

    document.execCommand('insertHTML', false, tableHtml);
    this.wrapOrphanTables();
    this.handleInput();
  }

  wrapOrphanTables(rootEl = null) {
    const root = rootEl || this.container;
    if (!root) return;
    const tables = root.querySelectorAll('table');
    tables.forEach(table => {
      const parent = table.parentElement;
      if (parent && !parent.classList.contains('rta-table-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'rta-table-wrap';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
    });
  }

  promptInsertTable() {
    const popoverBtn = document.querySelector('button[data-action="toggleTableMenu"]');
    if (popoverBtn) {
      popoverBtn.click();
      return;
    }
    const rInput = prompt('Enter number of rows:', '3');
    if (rInput === null) return;
    const cInput = prompt('Enter number of columns:', '3');
    if (cInput === null) return;
    this.insertTable(parseInt(rInput, 10) || 3, parseInt(cInput, 10) || 3);
  }

  saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      this.savedSelection = sel.getRangeAt(0).cloneRange();
    }
  }

  restoreSelection() {
    if (this.savedSelection) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(this.savedSelection);
      }
    }
  }

  insertLink(url, text = null) {
    if (!url) return;
    this.restoreSelection();
    this.focus();
    const safeUrl = sanitizeUrl(url);
    const sel = window.getSelection();
    let inserted = false;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && this.isEditorFocused()) {
      try {
        inserted = document.execCommand('createLink', false, safeUrl);
      } catch {
        inserted = false;
      }
    }

    if (!inserted) {
      const linkText = text || url;
      const html = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`;
      try {
        inserted = document.execCommand('insertHTML', false, html);
      } catch {
        inserted = false;
      }

      if (!inserted) {
        const targetPage = this.contentArea || this.pages[0];
        const body = targetPage?.querySelector('.rta-page-body') || targetPage;
        if (body) {
          const span = document.createElement('span');
          span.innerHTML = html + ' ';
          body.appendChild(span);
        }
      }
    }
    this.handleInput();
  }

  insertImage(url, alt = 'Uploaded Image') {
    if (!url) return;
    const targetPage = this.contentArea || this.pages[0];
    const body = targetPage?.querySelector('.rta-page-body') || targetPage;

    if (body) {
      body.focus();
    }
    this.restoreSelection();

    let safeUrl = sanitizeUrl(url, true);
    if (!safeUrl || safeUrl === '#') {
      const trimmed = url.trim();
      if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('./')) {
        safeUrl = trimmed;
      } else {
        safeUrl = `https://${trimmed}`;
      }
    }

    const imgHtml = `<figure class="rta-image-wrap"><img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(alt)}" class="rta-image"/><figcaption contenteditable="true">${escapeHtml(alt)}</figcaption></figure><p><br></p>`;

    let inserted = false;
    try {
      inserted = document.execCommand('insertHTML', false, imgHtml);
    } catch {
      inserted = false;
    }

    // Bulletproof fallback: If execCommand failed (e.g. selection lost), append directly into active body
    if (!inserted && body) {
      const div = document.createElement('div');
      div.innerHTML = imgHtml;
      while (div.firstChild) {
        body.appendChild(div.firstChild);
      }
    }

    this.handleInput();
  }

  insertDivider() {
    this.focus();
    document.execCommand('insertHorizontalRule', false, null);
    this.handleInput();
  }

  setPageLayout(layout) {
    if (['infinite', 'a4', 'letter', 'legal'].includes(layout)) {
      this.options.pageLayout = layout;
      if (this.pages && this.pages.length > 0) {
        this.pages.forEach(p => {
          p.className = `rta-page-sheet rta-editor rta-content-editable rta-layout-${layout}`;
        });
      } else if (this.contentArea) {
        this.contentArea.className = `rta-editor rta-content-editable rta-layout-${layout}`;
      }
      this.emit('layoutChange', layout);
      setTimeout(() => this.checkAutoPagination(), 50);
    }
  }

  recordSnapshot() {
    if (!this.isRecordingHistory || !this.contentArea) return;
    const currentHtml = this.getHTML();

    if (this.historyIndex >= 0 && this.history[this.historyIndex] === currentHtml) {
      return;
    }

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(currentHtml);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.isRecordingHistory = false;
      this.historyIndex--;
      this.setHTML(this.history[this.historyIndex]);
      this.isRecordingHistory = true;
      this.handleInput();
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.isRecordingHistory = false;
      this.historyIndex++;
      this.setHTML(this.history[this.historyIndex]);
      this.isRecordingHistory = true;
      this.handleInput();
    }
  }

  getHTML() {
    if (!this.pages || this.pages.length === 0) {
      return this.contentArea ? this.contentArea.innerHTML : '';
    }
    return this.pages.map(page => {
      const body = page.querySelector('.rta-page-body');
      return body ? body.innerHTML : page.innerHTML;
    }).join('\n<div class="rta-page-break-print" style="page-break-after:always;"></div>\n');
  }

  setHTML(html) {
    const cleanHtml = sanitizeHtml(html || '<p><br></p>');
    if (!this.pages || this.pages.length === 0) {
      if (this.contentArea) this.contentArea.innerHTML = cleanHtml;
      this.recordSnapshot();
      this.handleInput();
      return;
    }

    if (cleanHtml.includes('rta-page-break-print')) {
      const parts = cleanHtml.split(/<div class="rta-page-break-print"[^>]*><\/div>/i);
      while (this.pages.length > 1) {
        this.pages.pop().remove();
      }
      const firstBody = this.pages[0]?.querySelector('.rta-page-body');
      if (firstBody) firstBody.innerHTML = parts[0];
      else if (this.pages[0]) this.pages[0].innerHTML = parts[0];

      for (let i = 1; i < parts.length; i++) {
        if (parts[i].trim()) {
          const p = this.createPageSheet(this.pages.length + 1, parts[i]);
          this.pages.push(p);
          this.pagesContainer.appendChild(p);
        }
      }
    } else {
      while (this.pages.length > 1) {
        this.pages.pop().remove();
      }
      const firstBody = this.pages[0]?.querySelector('.rta-page-body');
      if (firstBody) firstBody.innerHTML = cleanHtml;
      else if (this.pages[0]) this.pages[0].innerHTML = cleanHtml;
    }

    this.wrapOrphanTables();
    this.recordSnapshot();
    this.handleInput();
  }

  getText() {
    if (!this.pages || this.pages.length === 0) {
      if (!this.contentArea) return '';
      return (this.contentArea.innerText || this.contentArea.textContent || '').trim();
    }
    return this.pages.map(page => {
      const header = page.querySelector('.rta-page-header-bar');
      const body = page.querySelector('.rta-page-body');
      if (body) {
        const bodyText = (body.innerText || body.textContent || '').trim();
        let extraText = '';
        Array.from(page.childNodes).forEach(node => {
          if (node !== header && node !== body) {
            extraText += ' ' + (node.innerText || node.textContent || '');
          }
        });
        return (bodyText + ' ' + extraText).trim();
      }
      return (page.innerText || page.textContent || '').trim();
    }).filter(Boolean).join('\n\n').trim();
  }

  getMarkdown() {
    return htmlToMarkdown(this.getHTML());
  }

  setMarkdown(md) {
    const html = markdownToHtml(md);
    this.setHTML(html);
  }

  getJSON() {
    return domToJSON(this.contentArea);
  }

  getStats() {
    const text = this.getText();
    const cleanText = text.replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, ' ').trim();
    const words = cleanText ? cleanText.split(/\s+/).filter(w => w.length > 0).length : 0;
    const chars = cleanText.length;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readingTime };
  }

  getSelectionState() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !this.isEditorFocused()) {
      return { isCollapsed: true, formats: {} };
    }

    const formats = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      orderedList: document.queryCommandState('insertOrderedList'),
      unorderedList: document.queryCommandState('insertUnorderedList'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
      justifyFull: document.queryCommandState('justifyFull')
    };

    return {
      isCollapsed: sel.isCollapsed,
      text: sel.toString(),
      formats
    };
  }

  isEditorFocused() {
    if (!this.contentArea) return false;
    const active = document.activeElement;
    return active === this.contentArea || this.contentArea.contains(active);
  }

  focus() {
    if (this.contentArea) {
      this.contentArea.focus();
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  emit(event, payload) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.forEach(cb => cb(payload));
    }
  }

  destroy() {
    this.listeners.clear();
    if (this.annotationTooltipEl) {
      this.annotationTooltipEl.remove();
      this.annotationTooltipEl = null;
    }
    if (this.pagesContainer) {
      this.pagesContainer.remove();
    } else if (this.container && this.contentArea) {
      this.contentArea.remove();
    }
    this.pages = [];
    this.contentArea = null;
    this.container = null;
  }
}

/**
 * Handcrafted Zero-Dependency HTML <-> Markdown Converters
 */
function htmlToMarkdown(html) {
  if (!html) return '';
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>|<b[^>]*>(.*?)<\/b>/gi, '**$1$2**')
    .replace(/<em[^>]*>(.*?)<\/em>|<i[^>]*>(.*?)<\/i>/gi, '*$1$2*')
    .replace(/<del[^>]*>(.*?)<\/del>|<strike[^>]*>(.*?)<\/strike>/gi, '~~$1$2~~')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
    .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>(.*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>(.*?)<\/ol>/gi, '$1\n')
    .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function markdownToHtml(md) {
  if (!md) return '<p><br></p>';
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/~~(.*?)~~/gim, '<del>$1</del>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/gim, '</p><p>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');
}

function domToJSON(el) {
  if (!el) return { type: 'doc', content: [] };
  const traverse = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return { type: 'text', text: node.textContent };
    }
    const children = Array.from(node.childNodes).map(traverse).filter(Boolean);
    return {
      type: node.nodeName.toLowerCase(),
      attrs: node.attributes ? Array.from(node.attributes).reduce((acc, a) => ({ ...acc, [a.name]: a.value }), {}) : {},
      content: children
    };
  };
  return {
    type: 'doc',
    content: Array.from(el.childNodes).map(traverse)
  };
}
