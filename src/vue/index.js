import { RichEditor } from '../index.js';

/**
 * Vue 3 Component Definition for richtext-all
 */
export const RichTextEditor = {
  name: 'RichTextEditor',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'Type something or press "/" for commands...'
    },
    pageLayout: {
      type: String,
      default: 'infinite' // 'infinite' | 'a4' | 'letter' | 'legal'
    },
    readOnly: {
      type: Boolean,
      default: false
    },
    toolbar: {
      type: Boolean,
      default: true
    },
    bubbleMenu: {
      type: Boolean,
      default: true
    },
    slashCommand: {
      type: Boolean,
      default: true
    },
    splitView: {
      type: Boolean,
      default: false
    },
    statusBar: {
      type: Boolean,
      default: true
    },
    collab: {
      type: Object,
      default: null
    },
    sync: {
      type: Object,
      default: null
    }
  },
  emits: ['update:modelValue', 'change', 'ready'],
  data() {
    return {
      editorInstance: null
    };
  },
  mounted() {
    this.editorInstance = new RichEditor(this.$el, {
      initialContent: this.modelValue,
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
        this.$emit('update:modelValue', html);
        this.$emit('change', html, stats);
      }
    });

    this.$emit('ready', this.editorInstance);
  },
  beforeUnmount() {
    if (this.editorInstance) {
      this.editorInstance.destroy();
      this.editorInstance = null;
    }
  },
  watch: {
    modelValue(newVal) {
      if (this.editorInstance && newVal !== this.editorInstance.getHTML()) {
        this.editorInstance.setHTML(newVal);
      }
    },
    pageLayout(newVal) {
      if (this.editorInstance) {
        this.editorInstance.setLayout(newVal);
      }
    }
  },
  methods: {
    getInstance() {
      return this.editorInstance;
    },
    getHTML() {
      return this.editorInstance?.getHTML() ?? '';
    },
    setHTML(html) {
      this.editorInstance?.setHTML(html);
    },
    getMarkdown() {
      return this.editorInstance?.getMarkdown() ?? '';
    },
    setMarkdown(md) {
      this.editorInstance?.setMarkdown(md);
    },
    getJSON() {
      return this.editorInstance?.getJSON() ?? null;
    },
    getText() {
      return this.editorInstance?.getText() ?? '';
    },
    getStats() {
      return this.editorInstance?.getStats() ?? { words: 0, chars: 0 };
    },
    getData() {
      return this.editorInstance?.getData();
    },
    setData(bundle) {
      return this.editorInstance?.setData(bundle);
    },
    getDocumentContext() {
      return this.editorInstance?.getDocumentContext();
    },
    setDocumentContext(bundle) {
      return this.editorInstance?.setDocumentContext(bundle);
    },
    saveVersion(title, desc) {
      return this.editorInstance?.saveVersion(title, desc);
    },
    getVersions() {
      return this.editorInstance?.getVersions() ?? [];
    },
    getVersion(id) {
      return this.editorInstance?.getVersion(id);
    },
    deleteVersion(id) {
      return this.editorInstance?.deleteVersion(id);
    },
    restoreVersion(id, opts) {
      return this.editorInstance?.restoreVersion(id, opts);
    },
    compareVersions(vA, vB) {
      return this.editorInstance?.compareVersions(vA, vB);
    },
    getComparisonList() {
      return this.editorInstance?.getComparisonList() ?? [];
    },
    showVersionHistory() {
      return this.editorInstance?.showVersionHistory();
    },
    showVersionComparison(vA, vB) {
      return this.editorInstance?.showVersionComparison(vA, vB);
    },
    getComments(filter) {
      return this.editorInstance?.getComments(filter) ?? [];
    },
    setComments(comments) {
      return this.editorInstance?.setComments(comments);
    },
    addComment(text) {
      return this.editorInstance?.addComment(text);
    },
    replyComment(commentId, text, user) {
      return this.editorInstance?.replyComment(commentId, text, user);
    },
    deleteCommentReply(commentId, replyId) {
      return this.editorInstance?.deleteCommentReply(commentId, replyId);
    },
    resolveComment(id, resolvedBy) {
      return this.editorInstance?.resolveComment(id, resolvedBy);
    },
    deleteComment(id) {
      return this.editorInstance?.deleteComment(id);
    },
    getSuggestions(filter) {
      return this.editorInstance?.getSuggestions(filter) ?? [];
    },
    setSuggestions(suggestions) {
      return this.editorInstance?.setSuggestions(suggestions);
    },
    acceptSuggestion(id, reviewer) {
      return this.editorInstance?.acceptSuggestion(id, reviewer);
    },
    rejectSuggestion(id, reviewer) {
      return this.editorInstance?.rejectSuggestion(id, reviewer);
    },
    clearAllAnnotations() {
      return this.editorInstance?.clearAllAnnotations();
    },
    clearCommentsAndSuggestions() {
      return this.editorInstance?.clearAllAnnotations();
    },
    importDocument(file, options) {
      return this.editorInstance?.importDocument(file, options);
    },
    getUsers() {
      return this.editorInstance?.getUsers() ?? [];
    },
    setUsers(users) {
      return this.editorInstance?.setUsers(users);
    },
    setUser(user) {
      return this.editorInstance?.setUser(user);
    },
    setReadOnly(ro) {
      return this.editorInstance?.setReadOnly(ro);
    },
    isReadOnly() {
      return this.editorInstance?.isReadOnly() ?? false;
    },
    exportDOCX(filename) {
      this.editorInstance?.exportDOCX(filename);
    },
    exportMarkdown(filename) {
      this.editorInstance?.exportMarkdown(filename);
    },
    exportHTML(filename) {
      this.editorInstance?.exportHTML(filename);
    },
    exportJSON(filename, full) {
      this.editorInstance?.exportJSON(filename, full);
    },
    exportContextJSON(filename) {
      this.editorInstance?.exportContextJSON(filename);
    },
    exportText(filename) {
      this.editorInstance?.exportText(filename);
    },
    disconnectCollab() {
      this.editorInstance?.disconnectCollab();
    },
    connectCollab(url) {
      this.editorInstance?.connectCollab(url);
    },
    isCollabConnected() {
      return this.editorInstance?.isCollabConnected() ?? false;
    },
    setLayout(layout) {
      this.editorInstance?.setLayout(layout);
    },
    focus() {
      this.editorInstance?.focus();
    }
  },
  render() {
    // Vue 3 / Vue 2 compatible render function returning a container div
    if (typeof this.$createElement === 'function') {
      return this.$createElement('div', { class: 'richtext-all-vue-wrapper' });
    }
    // Return standard JSX / h element representation
    return {
      type: 'div',
      props: { class: 'richtext-all-vue-wrapper' },
      children: []
    };
  }
};

export { RichTextEditor as RichEditor };
export default RichTextEditor;
