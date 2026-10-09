import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { RichEditor } from '../index.js';

/**
 * RichTextEditor - React Component for richtext-all
 */
export const RichTextEditor = forwardRef(function RichTextEditor(props, ref) {
  const {
    initialContent,
    placeholder,
    pageLayout = 'infinite',
    readOnly = false,
    toolbar = true,
    bubbleMenu = true,
    slashCommand = true,
    splitView = false,
    statusBar = true,
    collab = null,
    sync = null,
    onChange,
    onReady,
    className = '',
    style = {}
  } = props;

  const containerRef = useRef(null);
  const editorInstanceRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getInstance: () => editorInstanceRef.current,
    getHTML: () => editorInstanceRef.current?.getHTML() ?? '',
    setHTML: (html) => editorInstanceRef.current?.setHTML(html),
    getMarkdown: () => editorInstanceRef.current?.getMarkdown() ?? '',
    setMarkdown: (md) => editorInstanceRef.current?.setMarkdown(md),
    getJSON: () => editorInstanceRef.current?.getJSON() ?? null,
    getText: () => editorInstanceRef.current?.getText() ?? '',
    getStats: () => editorInstanceRef.current?.getStats() ?? { words: 0, chars: 0 },
    getData: () => editorInstanceRef.current?.getData(),
    setData: (bundle) => editorInstanceRef.current?.setData(bundle),
    getDocumentContext: () => editorInstanceRef.current?.getDocumentContext(),
    setDocumentContext: (bundle) => editorInstanceRef.current?.setDocumentContext(bundle),
    saveVersion: (title, desc) => editorInstanceRef.current?.saveVersion(title, desc),
    getVersions: () => editorInstanceRef.current?.getVersions() ?? [],
    getVersion: (id) => editorInstanceRef.current?.getVersion(id),
    deleteVersion: (id) => editorInstanceRef.current?.deleteVersion(id),
    restoreVersion: (id, opts) => editorInstanceRef.current?.restoreVersion(id, opts),
    compareVersions: (vA, vB) => editorInstanceRef.current?.compareVersions(vA, vB),
    getComparisonList: () => editorInstanceRef.current?.getComparisonList() ?? [],
    showVersionHistory: () => editorInstanceRef.current?.showVersionHistory(),
    showVersionComparison: (vA, vB) => editorInstanceRef.current?.showVersionComparison(vA, vB),
    getComments: (filter) => editorInstanceRef.current?.getComments(filter) ?? [],
    setComments: (c) => editorInstanceRef.current?.setComments(c),
    addComment: (text) => editorInstanceRef.current?.addComment(text),
    replyComment: (commentId, text, user) => editorInstanceRef.current?.replyComment(commentId, text, user),
    deleteCommentReply: (commentId, replyId) => editorInstanceRef.current?.deleteCommentReply(commentId, replyId),
    resolveComment: (id, resolvedBy) => editorInstanceRef.current?.resolveComment(id, resolvedBy),
    deleteComment: (id) => editorInstanceRef.current?.deleteComment(id),
    getSuggestions: (filter) => editorInstanceRef.current?.getSuggestions(filter) ?? [],
    setSuggestions: (s) => editorInstanceRef.current?.setSuggestions(s),
    acceptSuggestion: (id, reviewer) => editorInstanceRef.current?.acceptSuggestion(id, reviewer),
    rejectSuggestion: (id, reviewer) => editorInstanceRef.current?.rejectSuggestion(id, reviewer),
    clearAllAnnotations: () => editorInstanceRef.current?.clearAllAnnotations(),
    clearCommentsAndSuggestions: () => editorInstanceRef.current?.clearAllAnnotations(),
    importDocument: (file, opts) => editorInstanceRef.current?.importDocument(file, opts),
    getUsers: () => editorInstanceRef.current?.getUsers() ?? [],
    setUsers: (u) => editorInstanceRef.current?.setUsers(u),
    setUser: (u) => editorInstanceRef.current?.setUser(u),
    setReadOnly: (ro) => editorInstanceRef.current?.setReadOnly(ro),
    isReadOnly: () => editorInstanceRef.current?.isReadOnly() ?? false,
    exportDOCX: (filename) => editorInstanceRef.current?.exportDOCX(filename),
    exportMarkdown: (filename) => editorInstanceRef.current?.exportMarkdown(filename),
    exportHTML: (filename) => editorInstanceRef.current?.exportHTML(filename),
    exportJSON: (filename, full) => editorInstanceRef.current?.exportJSON(filename, full),
    exportContextJSON: (filename) => editorInstanceRef.current?.exportContextJSON(filename),
    exportText: (filename) => editorInstanceRef.current?.exportText(filename),
    disconnectCollab: () => editorInstanceRef.current?.disconnectCollab(),
    connectCollab: (url) => editorInstanceRef.current?.connectCollab(url),
    isCollabConnected: () => editorInstanceRef.current?.isCollabConnected() ?? false,
    focus: () => editorInstanceRef.current?.focus(),
    setLayout: (layout) => editorInstanceRef.current?.setLayout(layout)
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = new RichEditor(containerRef.current, {
      initialContent,
      placeholder,
      pageLayout,
      readOnly,
      toolbar,
      bubbleMenu,
      slashCommand,
      splitView,
      statusBar,
      collab,
      sync,
      onChange
    });

    editorInstanceRef.current = editor;

    if (typeof onReady === 'function') {
      onReady(editor);
    }

    return () => {
      editor.destroy();
      editorInstanceRef.current = null;
    };
  }, []);

  return React.createElement('div', {
    ref: containerRef,
    className: `richtext-all-react-wrapper ${className}`.trim(),
    style: { width: '100%', ...style }
  });
});

/**
 * useRichEditor Hook for custom programmatic control
 */
export function useRichEditor(containerRef, options = {}) {
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = new RichEditor(containerRef.current, options);
    instanceRef.current = editor;

    return () => {
      editor.destroy();
      instanceRef.current = null;
    };
  }, []);

  return instanceRef.current;
}

export { RichTextEditor as RichEditor };
export default RichTextEditor;
