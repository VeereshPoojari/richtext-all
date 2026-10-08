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
    exportDOCX: (filename) => editorInstanceRef.current?.exportDOCX(filename),
    exportMarkdown: (filename) => editorInstanceRef.current?.exportMarkdown(filename),
    exportHTML: (filename) => editorInstanceRef.current?.exportHTML(filename),
    exportJSON: (filename) => editorInstanceRef.current?.exportJSON(filename),
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

  return (
    <div 
      ref={containerRef} 
      className={`richtext-all-react-wrapper ${className}`} 
      style={{ width: '100%', ...style }} 
    />
  );
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

export default RichTextEditor;
