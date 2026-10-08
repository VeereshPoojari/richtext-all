import { RichEditor } from '../index.js';

/**
 * Angular Adapter for richtext-all
 * Compatible with Angular 14+ standalone components & NG_VALUE_ACCESSOR
 */
export class RichTextEditorComponent {
  constructor(elementRef) {
    this.elementRef = elementRef;
    this.editorInstance = null;
    this.onChangeCallback = () => {};
    this.onTouchedCallback = () => {};

    // Inputs
    this.placeholder = 'Type something or press "/" for commands...';
    this.pageLayout = 'infinite';
    this.readOnly = false;
    this.toolbar = true;
    this.bubbleMenu = true;
    this.slashCommand = true;
    this.splitView = false;
    this.statusBar = true;
    this.collab = null;
    this.sync = null;

    // Outputs
    this.change = { emit: () => {} };
    this.ready = { emit: () => {} };
  }

  ngOnInit() {
    const el = this.elementRef?.nativeElement || this.elementRef;
    if (!el) return;

    this.editorInstance = new RichEditor(el, {
      initialContent: this.value || '',
      placeholder: this.placeholder,
      pageLayout: this.pageLayout,
      readOnly: this.readOnly,
      toolbar: this.toolbar,
      bubbleMenu: this.bubbleMenu,
      slashCommand: this.slashCommand,
      splitView: this.splitView,
      statusBar: this.statusBar,
      collab: this.collab,
      sync: this.sync,
      onChange: (html, stats) => {
        this.onChangeCallback(html);
        this.change.emit({ html, stats });
      }
    });

    this.ready.emit(this.editorInstance);
  }

  ngOnDestroy() {
    if (this.editorInstance) {
      this.editorInstance.destroy();
      this.editorInstance = null;
    }
  }

  // ControlValueAccessor methods
  writeValue(value) {
    this.value = value;
    if (this.editorInstance && value !== this.editorInstance.getHTML()) {
      this.editorInstance.setHTML(value || '');
    }
  }

  registerOnChange(fn) {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn) {
    this.onTouchedCallback = fn;
  }

  setDisabledState(isDisabled) {
    this.readOnly = isDisabled;
    if (this.editorInstance && this.editorInstance.core) {
      this.editorInstance.core.el.contentEditable = !isDisabled;
    }
  }

  getHTML() {
    return this.editorInstance?.getHTML() ?? '';
  }

  setHTML(html) {
    this.editorInstance?.setHTML(html);
  }

  getMarkdown() {
    return this.editorInstance?.getMarkdown() ?? '';
  }

  setMarkdown(md) {
    this.editorInstance?.setMarkdown(md);
  }

  exportDOCX(filename) {
    this.editorInstance?.exportDOCX(filename);
  }
}

export default RichTextEditorComponent;
