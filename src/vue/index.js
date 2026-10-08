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
    exportDOCX(filename) {
      this.editorInstance?.exportDOCX(filename);
    },
    exportMarkdown(filename) {
      this.editorInstance?.exportMarkdown(filename);
    },
    exportHTML(filename) {
      this.editorInstance?.exportHTML(filename);
    },
    exportJSON(filename) {
      this.editorInstance?.exportJSON(filename);
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

export default RichTextEditor;
