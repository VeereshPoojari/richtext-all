export class SplitView {
  constructor(editor) {
    this.editor = editor;
    this.wrapper = null;
    this.sourceTextarea = null;
    this.previewPane = null;
    this.isActive = false;
    this.isSyncing = false;
  }

  mount(containerEl) {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'rta-split-view-wrapper';
    this.wrapper.style.display = 'none';

    this.wrapper.innerHTML = `
      <div class="rta-split-pane rta-split-source">
        <div class="rta-split-header">
          <span class="rta-split-badge">Markdown Source</span>
          <span class="rta-split-hint">Live Bidirectional Sync</span>
        </div>
        <textarea class="rta-source-textarea" placeholder="Type Markdown here..."></textarea>
      </div>

      <div class="rta-split-divider"></div>

      <div class="rta-split-pane rta-split-preview">
        <div class="rta-split-header">
          <span class="rta-split-badge rta-split-badge-live">Live Preview</span>
          <span class="rta-split-stats" id="rta-split-stats">0 words</span>
        </div>
        <div class="rta-preview-content"></div>
      </div>
    `;

    containerEl.appendChild(this.wrapper);
    this.sourceTextarea = this.wrapper.querySelector('.rta-source-textarea');
    this.previewPane = this.wrapper.querySelector('.rta-preview-content');

    this.bindSync();
  }

  bindSync() {
    // When editing raw markdown on the left
    this.sourceTextarea.addEventListener('input', () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      const md = this.sourceTextarea.value;
      this.editor.setMarkdown(md);
      this.updatePreview();
      this.isSyncing = false;
    });

    // When editing on the visual editor
    this.editor.on('change', () => {
      if (!this.isActive || this.isSyncing) return;
      this.isSyncing = true;
      this.sourceTextarea.value = this.editor.getMarkdown();
      this.updatePreview();
      this.isSyncing = false;
    });

    // Synchronized Dual-Scroll
    let isScrollingSource = false;
    let isScrollingPreview = false;

    this.sourceTextarea.addEventListener('scroll', () => {
      if (isScrollingPreview) return;
      isScrollingSource = true;
      const percentage = this.sourceTextarea.scrollTop / (this.sourceTextarea.scrollHeight - this.sourceTextarea.clientHeight);
      this.previewPane.scrollTop = percentage * (this.previewPane.scrollHeight - this.previewPane.clientHeight);
      setTimeout(() => { isScrollingSource = false; }, 50);
    });

    this.previewPane.addEventListener('scroll', () => {
      if (isScrollingSource) return;
      isScrollingPreview = true;
      const percentage = this.previewPane.scrollTop / (this.previewPane.scrollHeight - this.previewPane.clientHeight);
      this.sourceTextarea.scrollTop = percentage * (this.sourceTextarea.scrollHeight - this.sourceTextarea.clientHeight);
      setTimeout(() => { isScrollingPreview = false; }, 50);
    });
  }

  updatePreview() {
    if (this.previewPane) {
      this.previewPane.innerHTML = this.editor.getHTML();
      const stats = this.editor.getStats();
      const statsEl = this.wrapper.querySelector('#rta-split-stats');
      if (statsEl) {
        statsEl.textContent = `${stats.words} words | ${stats.chars} chars`;
      }
    }
  }

  toggle() {
    if (this.isActive) {
      this.hide();
    } else {
      this.show();
    }
  }

  show() {
    this.isActive = true;
    if (this.editor.contentArea) {
      this.editor.contentArea.style.display = 'none';
    }
    if (this.wrapper) {
      this.wrapper.style.display = 'flex';
      this.sourceTextarea.value = this.editor.getMarkdown();
      this.updatePreview();
    }
  }

  hide() {
    this.isActive = false;
    if (this.wrapper) {
      this.wrapper.style.display = 'none';
    }
    if (this.editor.contentArea) {
      this.editor.contentArea.style.display = 'block';
      this.editor.focus();
    }
  }

  destroy() {
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
    this.wrapper = null;
  }
}
