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

  getInstance() {
    return this.editorInstance;
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

  getJSON() {
    return this.editorInstance?.getJSON() ?? null;
  }

  getText() {
    return this.editorInstance?.getText() ?? '';
  }

  getData() {
    return this.editorInstance?.getData();
  }

  setData(bundle) {
    return this.editorInstance?.setData(bundle);
  }

  getDocumentContext() {
    return this.editorInstance?.getDocumentContext();
  }

  setDocumentContext(bundle) {
    return this.editorInstance?.setDocumentContext(bundle);
  }

  saveVersion(title, desc) {
    return this.editorInstance?.saveVersion(title, desc);
  }

  getVersions() {
    return this.editorInstance?.getVersions() ?? [];
  }

  getVersion(id) {
    return this.editorInstance?.getVersion(id);
  }

  deleteVersion(id) {
    return this.editorInstance?.deleteVersion(id);
  }

  restoreVersion(id, opts) {
    return this.editorInstance?.restoreVersion(id, opts);
  }

  compareVersions(vA, vB) {
    return this.editorInstance?.compareVersions(vA, vB);
  }

  getComparisonList() {
    return this.editorInstance?.getComparisonList() ?? [];
  }

  showVersionHistory() {
    return this.editorInstance?.showVersionHistory();
  }

  showVersionComparison(vA, vB) {
    return this.editorInstance?.showVersionComparison(vA, vB);
  }

  getComments(filter) {
    return this.editorInstance?.getComments(filter) ?? [];
  }

  setComments(comments) {
    return this.editorInstance?.setComments(comments);
  }

  addComment(text) {
    return this.editorInstance?.addComment(text);
  }

  replyComment(commentId, text, user) {
    return this.editorInstance?.replyComment(commentId, text, user);
  }

  deleteCommentReply(commentId, replyId) {
    return this.editorInstance?.deleteCommentReply(commentId, replyId);
  }

  resolveComment(id, resolvedBy) {
    return this.editorInstance?.resolveComment(id, resolvedBy);
  }

  deleteComment(id) {
    return this.editorInstance?.deleteComment(id);
  }

  getSuggestions(filter) {
    return this.editorInstance?.getSuggestions(filter) ?? [];
  }

  setSuggestions(suggestions) {
    return this.editorInstance?.setSuggestions(suggestions);
  }

  acceptSuggestion(id, reviewer) {
    return this.editorInstance?.acceptSuggestion(id, reviewer);
  }

  rejectSuggestion(id, reviewer) {
    return this.editorInstance?.rejectSuggestion(id, reviewer);
  }

  clearAllAnnotations() {
    return this.editorInstance?.clearAllAnnotations();
  }

  clearCommentsAndSuggestions() {
    return this.editorInstance?.clearAllAnnotations();
  }

  importDocument(file, options) {
    return this.editorInstance?.importDocument(file, options);
  }

  getUsers() {
    return this.editorInstance?.getUsers() ?? [];
  }

  setUsers(users) {
    return this.editorInstance?.setUsers(users);
  }

  setUser(user) {
    return this.editorInstance?.setUser(user);
  }

  setReadOnly(ro) {
    this.setDisabledState(ro);
    return this.editorInstance?.setReadOnly(ro);
  }

  isReadOnly() {
    return this.editorInstance?.isReadOnly() ?? false;
  }

  exportDOCX(filename) {
    this.editorInstance?.exportDOCX(filename);
  }

  exportMarkdown(filename) {
    this.editorInstance?.exportMarkdown(filename);
  }

  exportHTML(filename) {
    this.editorInstance?.exportHTML(filename);
  }

  exportJSON(filename, full) {
    this.editorInstance?.exportJSON(filename, full);
  }

  exportContextJSON(filename) {
    this.editorInstance?.exportContextJSON(filename);
  }

  exportText(filename) {
    this.editorInstance?.exportText(filename);
  }

  disconnectCollab() {
    this.editorInstance?.disconnectCollab();
  }

  connectCollab(url) {
    this.editorInstance?.connectCollab(url);
  }

  isCollabConnected() {
    return this.editorInstance?.isCollabConnected() ?? false;
  }

  setLayout(layout) {
    this.editorInstance?.setLayout(layout);
  }

  focus() {
    this.editorInstance?.focus();
  }
}

export { RichTextEditorComponent as RichEditor, RichTextEditorComponent as RichTextEditor };
export default RichTextEditorComponent;
