export class BubbleMenu {
  constructor(editor) {
    this.editor = editor;
    this.element = null;
    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.element.className = 'rta-bubble-menu';
    this.element.innerHTML = `
      <button type="button" class="rta-bubble-btn" data-cmd="bold"><b>B</b></button>
      <button type="button" class="rta-bubble-btn" data-cmd="italic"><i>I</i></button>
      <button type="button" class="rta-bubble-btn" data-cmd="underline"><u>U</u></button>
      <button type="button" class="rta-bubble-btn" data-cmd="strikeThrough"><s>S</s></button>
      <button type="button" class="rta-bubble-btn" data-cmd="heading" data-val="h2">H2</button>
      <button type="button" class="rta-bubble-btn" data-cmd="blockquote">“</button>
      <button type="button" class="rta-bubble-btn" data-action="link">🔗</button>
      <button type="button" class="rta-bubble-btn" data-cmd="highlight" data-val="#fef08a">🖌</button>
    `;

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
    this.element.addEventListener('mousedown', (e) => {
      // Prevent editor from losing focus
      e.preventDefault();
    });

    this.element.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const cmd = btn.getAttribute('data-cmd');
      const val = btn.getAttribute('data-val');
      const action = btn.getAttribute('data-action');

      if (cmd) {
        this.editor.format(cmd, val);
      } else if (action === 'link') {
        const url = prompt('Enter link URL:');
        if (url) this.editor.format('link', url);
      }
      this.updatePosition();
    });

    this.editor.on('selectionChange', (state) => {
      if (state.isCollapsed || !state.text || state.text.trim().length === 0) {
        this.hide();
      } else {
        this.show();
      }
    });

    window.addEventListener('resize', () => this.updatePosition());
    window.addEventListener('scroll', () => this.updatePosition(), true);
  }

  show() {
    if (!this.element) return;
    this.element.classList.add('visible');
    this.updatePosition();
  }

  hide() {
    if (!this.element) return;
    this.element.classList.remove('visible');
  }

  updatePosition() {
    if (!this.element || !this.element.classList.contains('visible')) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      this.hide();
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hide();
      return;
    }

    const bubbleWidth = this.element.offsetWidth || 260;
    const bubbleHeight = this.element.offsetHeight || 38;

    let top = rect.top - bubbleHeight - 8;
    let left = rect.left + (rect.width / 2) - (bubbleWidth / 2);

    if (top < 10) {
      // Show below selection if clipped at top
      top = rect.bottom + 8;
    }

    if (left < 10) left = 10;
    if (left + bubbleWidth > window.innerWidth - 10) {
      left = window.innerWidth - bubbleWidth - 10;
    }

    this.element.style.top = `${window.scrollY + top}px`;
    this.element.style.left = `${window.scrollX + left}px`;
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}
