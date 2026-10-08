/**
 * SyncAdapter.js - Server persistence, auto-save & multi-format export adapter
 * Zero-dependency data sync for REST endpoints and local file exports.
 */

export class SyncAdapter {
  constructor(editor, options = {}) {
    this.editor = editor;
    this.options = {
      endpoint: null,          // e.g. '/api/documents/doc-1'
      method: 'POST',          // 'POST' or 'PUT'
      autoSave: true,
      autoSaveInterval: 1500,  // Debounce in ms
      headers: {
        'Content-Type': 'application/json'
      },
      onSave: null,            // Callback (result, payload) => {}
      onError: null,           // Callback (error) => {}
      onStatusChange: null,    // Callback (status: 'idle' | 'saving' | 'saved' | 'error') => {}
      ...options
    };

    this.status = 'idle';      // 'idle' | 'saving' | 'saved' | 'error'
    this.saveTimeout = null;
    this.badgeEl = null;

    if (this.options.autoSave && this.options.endpoint) {
      this.initAutoSave();
    }
  }

  mountStatusBadge(containerEl) {
    if (!containerEl) return;
    this.badgeEl = document.createElement('div');
    this.badgeEl.className = 'rta-sync-badge rta-badge-idle';
    this.badgeEl.innerHTML = '<span class="rta-badge-dot"></span> <span class="rta-badge-text">Ready</span>';
    containerEl.appendChild(this.badgeEl);
    this.updateBadge();
  }

  initAutoSave() {
    this.editor.on('change', () => {
      this.setStatus('idle');
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = setTimeout(() => {
        this.saveToServer();
      }, this.options.autoSaveInterval);
    });
  }

  setStatus(status, message = null) {
    this.status = status;
    this.updateBadge(message);
    if (typeof this.options.onStatusChange === 'function') {
      this.options.onStatusChange(status);
    }
  }

  updateBadge(customMessage = null) {
    if (!this.badgeEl) return;
    this.badgeEl.className = `rta-sync-badge rta-badge-${this.status}`;
    const textEl = this.badgeEl.querySelector('.rta-badge-text');
    if (!textEl) return;

    if (customMessage) {
      textEl.textContent = customMessage;
      return;
    }

    switch (this.status) {
      case 'saving':
        textEl.textContent = 'Saving...';
        break;
      case 'saved':
        textEl.textContent = 'Saved to cloud';
        break;
      case 'error':
        textEl.textContent = 'Save failed';
        break;
      case 'idle':
      default:
        textEl.textContent = 'All changes saved';
        break;
    }
  }

  async saveToServer(overridePayload = null) {
    if (!this.options.endpoint) {
      console.warn('[SyncAdapter] No endpoint configured for saveToServer');
      return null;
    }

    this.setStatus('saving');

    const payload = overridePayload || {
      html: this.editor.getHTML(),
      markdown: this.editor.getMarkdown(),
      json: this.getJSON(),
      text: this.editor.getText(),
      stats: this.editor.getStats(),
      updatedAt: new Date().toISOString()
    };

    try {
      const headers = typeof this.options.headers === 'function' 
        ? await this.options.headers() 
        : this.options.headers;

      const response = await fetch(this.options.endpoint, {
        method: this.options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json().catch(() => ({ success: true }));
      this.setStatus('saved');

      if (typeof this.options.onSave === 'function') {
        this.options.onSave(result, payload);
      }

      // Revert badge to idle after 3 seconds
      setTimeout(() => {
        if (this.status === 'saved') {
          this.setStatus('idle');
        }
      }, 3000);

      return result;
    } catch (err) {
      this.setStatus('error', 'Sync error');
      console.error('[SyncAdapter] Save failed:', err);
      if (typeof this.options.onError === 'function') {
        this.options.onError(err);
      }
      throw err;
    }
  }

  getJSON() {
    const el = this.editor.el;
    if (!el) return { type: 'doc', content: [] };

    const parseNode = (node) => {
      if (node.nodeType === 3) { // Text node
        return { type: 'text', text: node.textContent };
      }
      if (node.nodeType === 1) { // Element node
        const tag = node.tagName.toLowerCase();
        const attrs = {};
        for (let i = 0; i < node.attributes.length; i++) {
          const attr = node.attributes[i];
          attrs[attr.name] = attr.value;
        }

        const children = [];
        node.childNodes.forEach(child => {
          const parsed = parseNode(child);
          if (parsed) children.push(parsed);
        });

        return {
          type: tag,
          attrs: Object.keys(attrs).length ? attrs : undefined,
          children: children.length ? children : undefined
        };
      }
      return null;
    };

    const content = [];
    el.childNodes.forEach(child => {
      const parsed = parseNode(child);
      if (parsed) content.push(parsed);
    });

    return {
      type: 'doc',
      stats: this.editor.getStats(),
      content
    };
  }

  downloadBlob(blob, filename) {
    if (typeof window === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportHTML(filename = 'document.html') {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${filename.replace(/\.html$/i, '')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
    h1, h2, h3 { color: #0f172a; margin-top: 1.5em; }
    blockquote { border-left: 4px solid #6366f1; margin: 1em 0; padding-left: 1em; color: #475569; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
    th { background: #f8fafc; font-weight: 600; }
    pre { background: #1e293b; color: #f8fafc; padding: 14px; border-radius: 6px; overflow-x: auto; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>
</head>
<body>
${this.editor.getHTML()}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    this.downloadBlob(blob, filename);
  }

  exportMarkdown(filename = 'document.md') {
    const md = this.editor.getMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    this.downloadBlob(blob, filename);
  }

  exportJSON(filename = 'document.json') {
    const jsonStr = JSON.stringify(this.getJSON(), null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    this.downloadBlob(blob, filename);
  }

  exportText(filename = 'document.txt') {
    const text = this.editor.getText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    this.downloadBlob(blob, filename);
  }

  /**
   * Generates a Microsoft Word compatible (.docx / Word HTML package) without external libraries
   */
  exportDOCX(filename = 'document.doc') {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Document</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: 21cm 29.7cm; /* A4 */
            margin: 2cm 2cm 2cm 2cm;
            mso-page-orientation: portrait;
          }
          body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #000000;
          }
          h1 { font-size: 22pt; color: #2E74B5; margin-bottom: 8pt; }
          h2 { font-size: 16pt; color: #2E74B5; margin-bottom: 6pt; }
          h3 { font-size: 13pt; color: #1F4D78; margin-bottom: 4pt; }
          table { border-collapse: collapse; width: 100%; margin-top: 10pt; margin-bottom: 10pt; }
          td, th { border: 1pt solid #D3D3D3; padding: 6pt; }
          th { background-color: #F2F2F2; font-weight: bold; }
          blockquote { border-left: 3pt solid #4A90E2; margin-left: 0; padding-left: 10pt; color: #555555; }
        </style>
      </head>
      <body>
        ${this.editor.getHTML()}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8'
    });
    this.downloadBlob(blob, filename);
  }

  destroy() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }
}
