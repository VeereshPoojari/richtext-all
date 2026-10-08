export class SlashCommand {
  constructor(editor) {
    this.editor = editor;
    this.element = null;
    this.isOpen = false;
    this.commands = [
      { id: 'h1', title: 'Heading 1', desc: 'Large document heading', icon: 'H1', action: () => this.editor.format('heading', 'h1') },
      { id: 'h2', title: 'Heading 2', desc: 'Medium section heading', icon: 'H2', action: () => this.editor.format('heading', 'h2') },
      { id: 'h3', title: 'Heading 3', desc: 'Small subsection heading', icon: 'H3', action: () => this.editor.format('heading', 'h3') },
      { id: 'ul', title: 'Bullet List', desc: 'Create a simple bulleted list', icon: '•', action: () => this.editor.format('insertUnorderedList') },
      { id: 'ol', title: 'Numbered List', desc: 'Create a sequential numbered list', icon: '1.', action: () => this.editor.format('insertOrderedList') },
      { id: 'quote', title: 'Quote', desc: 'Capture a memorable blockquote', icon: '“', action: () => this.editor.format('blockquote') },
      { id: 'table', title: 'Table', desc: 'Insert custom table with rows & columns', icon: '📊', action: () => this.editor.promptInsertTable() },
      { id: 'code', title: 'Code Block', desc: 'Display formatted code snippet', icon: '</>', action: () => this.editor.format('codeBlock') },
      { id: 'divider', title: 'Divider', desc: 'Visually divide sections', icon: '—', action: () => this.editor.insertDivider() }
    ];
    this.selectedIndex = 0;
    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.element.className = 'rta-slash-menu';
    document.body.appendChild(this.element);
    this.bindEvents();
  }

  mount(container = null) {
    if (!this.element) {
      this.init();
    }
    return this;
  }

  bindEvents() {
    this.editor.contentArea?.addEventListener('keydown', (e) => {
      if (this.isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedIndex = (this.selectedIndex + 1) % this.commands.length;
          this.renderList();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedIndex = (this.selectedIndex - 1 + this.commands.length) % this.commands.length;
          this.renderList();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.executeSelected();
        } else if (e.key === 'Escape') {
          this.hide();
        }
      } else if (e.key === '/') {
        setTimeout(() => this.checkTrigger(), 10);
      }
    });

    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.element.contains(e.target)) {
        this.hide();
      }
    });
  }

  checkTrigger() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const textBefore = range.startContainer.textContent?.substring(0, range.startOffset) || '';

    if (textBefore.endsWith('/')) {
      this.show(range);
    }
  }

  show(range) {
    this.isOpen = true;
    this.selectedIndex = 0;
    this.renderList();
    this.element.classList.add('visible');

    const rect = range.getBoundingClientRect();
    const menuWidth = 280;
    let top = rect.bottom + 8;
    let left = rect.left;

    if (left + menuWidth > window.innerWidth - 16) {
      left = window.innerWidth - menuWidth - 16;
    }

    this.element.style.top = `${window.scrollY + top}px`;
    this.element.style.left = `${window.scrollX + left}px`;
  }

  hide() {
    this.isOpen = false;
    this.element.classList.remove('visible');
  }

  renderList() {
    this.element.innerHTML = `
      <div class="rta-slash-header">BASIC BLOCKS</div>
      <div class="rta-slash-list">
        ${this.commands.map((cmd, idx) => `
          <div class="rta-slash-item ${idx === this.selectedIndex ? 'selected' : ''}" data-idx="${idx}">
            <div class="rta-slash-icon">${cmd.icon}</div>
            <div class="rta-slash-info">
              <div class="rta-slash-title">${cmd.title}</div>
              <div class="rta-slash-desc">${cmd.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    this.element.querySelectorAll('.rta-slash-item').forEach(item => {
      item.onclick = () => {
        this.selectedIndex = parseInt(item.getAttribute('data-idx'), 10);
        this.executeSelected();
      };
    });
  }

  executeSelected() {
    const cmd = this.commands[this.selectedIndex];
    if (cmd) {
      // Remove the triggering '/' before executing
      document.execCommand('delete', false, null);
      cmd.action();
    }
    this.hide();
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}
