import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const srcTypes = path.join(rootDir, 'src', 'types', 'index.d.ts');
const distTypesDir = path.join(rootDir, 'dist', 'types');
const distReactDir = path.join(rootDir, 'dist', 'react');
const distVueDir = path.join(rootDir, 'dist', 'vue');
const distAngularDir = path.join(rootDir, 'dist', 'angular');

[distTypesDir, distReactDir, distVueDir, distAngularDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy core types
fs.copyFileSync(srcTypes, path.join(distTypesDir, 'index.d.ts'));

// React types
fs.writeFileSync(
  path.join(distReactDir, 'index.d.ts'),
  `import React from 'react';
import { 
  RichEditorOptions, 
  RichEditor, 
  DocumentContextBundle, 
  VersionSnapshot, 
  VersionComparisonResult, 
  ComparisonListItem, 
  CommentItem, 
  CommentReply,
  SuggestionItem, 
  CollabUser, 
  PageLayout, 
  EditorStats,
  ClearAnnotationsAudit,
  ImportDocumentOptions
} from '../types/index';

export interface RichEditorHandle {
  getInstance(): RichEditor | null;
  getHTML(): string;
  setHTML(html: string): void;
  getMarkdown(): string;
  setMarkdown(md: string): void;
  getJSON(): any;
  getText(): string;
  getStats(): EditorStats;
  getData(): DocumentContextBundle | undefined;
  setData(bundle: Partial<DocumentContextBundle>): boolean | undefined;
  getDocumentContext(): DocumentContextBundle | undefined;
  setDocumentContext(bundle: Partial<DocumentContextBundle>): boolean | undefined;
  saveVersion(title?: string, desc?: string): VersionSnapshot | undefined;
  getVersions(): VersionSnapshot[];
  getVersion(id: string): VersionSnapshot | null | undefined;
  deleteVersion(id: string): VersionSnapshot | null | undefined;
  restoreVersion(id: string, opts?: any): boolean | undefined;
  compareVersions(vA: string, vB?: string): VersionComparisonResult | undefined;
  getComparisonList(): ComparisonListItem[];
  showVersionHistory(): void;
  showVersionComparison(vA?: string | null, vB?: string): void;
  getComments(filter?: { resolved?: boolean }): CommentItem[];
  setComments(c: CommentItem[]): CommentItem[] | undefined;
  addComment(text: string): CommentItem | void;
  replyComment(commentId: string, text: string, user?: CollabUser | null): CommentReply | null;
  deleteCommentReply(commentId: string, replyId: string): CommentReply | boolean;
  resolveComment(id: string, resolvedBy?: string | null): CommentItem | null;
  deleteComment(id: string): CommentItem | boolean;
  clearAllAnnotations(): ClearAnnotationsAudit | undefined;
  clearCommentsAndSuggestions(): ClearAnnotationsAudit | undefined;
  getSuggestions(filter?: { status?: 'pending' | 'accepted' | 'rejected' }): SuggestionItem[];
  setSuggestions(s: SuggestionItem[]): SuggestionItem[] | undefined;
  acceptSuggestion(id: string, reviewer?: CollabUser | null): SuggestionItem | null;
  rejectSuggestion(id: string, reviewer?: CollabUser | null): SuggestionItem | null;
  getUsers(): CollabUser[];
  setUsers(u: CollabUser[]): CollabUser[] | undefined;
  setUser(u: string | CollabUser): CollabUser | undefined;
  setReadOnly(ro?: boolean): boolean | undefined;
  isReadOnly(): boolean;
  exportDOCX(filename?: string): void;
  exportMarkdown(filename?: string): void;
  exportHTML(filename?: string): void;
  exportJSON(filename?: string, full?: boolean): void;
  exportContextJSON(filename?: string): void;
  exportText(filename?: string): void;
  importDocument(file: File | Blob, options?: ImportDocumentOptions): Promise<string | null>;
  disconnectCollab(): void;
  connectCollab(url?: string): void;
  isCollabConnected(): boolean;
  focus(): void;
  setLayout(layout: PageLayout): void;
  addNewPage(): HTMLElement | undefined;
  insertPageAt(targetPageNumber: number, initialHtml?: string): HTMLElement | undefined;
  insertPageAfter(pageNumber: number, initialHtml?: string): HTMLElement | undefined;
  insertPageBefore(pageNumber: number, initialHtml?: string): HTMLElement | undefined;
  removePage(pageNumber: number): boolean | undefined;
  movePage(fromPageNumber: number, toPageNumber: number): boolean | undefined;
  movePageUp(pageNumber: number): boolean | undefined;
  movePageDown(pageNumber: number): boolean | undefined;
  reorderPages(newOrder: number[]): boolean | undefined;
  getPageCount(): number;
  getPage(pageNumber: number): HTMLElement | null | undefined;
  getPageHTML(pageNumber: number): string;
  setPageHTML(pageNumber: number, html: string): boolean | undefined;
}

export interface RichTextEditorProps extends RichEditorOptions {
  className?: string;
  style?: React.CSSProperties;
  onReady?: (editor: RichEditor) => void;
}

export declare const RichTextEditor: React.ForwardRefExoticComponent<
  RichTextEditorProps & React.RefAttributes<RichEditorHandle>
>;

export declare function useRichEditor(
  ref: React.RefObject<HTMLElement>,
  options?: RichEditorOptions
): RichEditor | null;

export { RichTextEditor as RichEditor };
export default RichTextEditor;
`
);

// Vue types
fs.writeFileSync(
  path.join(distVueDir, 'index.d.ts'),
  `import { DefineComponent } from 'vue';
import { 
  RichEditorOptions, 
  RichEditor, 
  DocumentContextBundle, 
  VersionSnapshot, 
  VersionComparisonResult, 
  ComparisonListItem, 
  CommentItem, 
  CommentReply,
  SuggestionItem, 
  CollabUser, 
  PageLayout, 
  EditorStats,
  ClearAnnotationsAudit,
  ImportDocumentOptions
} from '../types/index';

export interface RichTextEditorInstance {
  getInstance(): RichEditor | null;
  getHTML(): string;
  setHTML(html: string): void;
  getMarkdown(): string;
  setMarkdown(md: string): void;
  getJSON(): any;
  getText(): string;
  getStats(): EditorStats;
  getData(): DocumentContextBundle;
  setData(bundle: Partial<DocumentContextBundle>): boolean;
  getDocumentContext(): DocumentContextBundle;
  setDocumentContext(bundle: Partial<DocumentContextBundle>): boolean;
  saveVersion(title?: string, desc?: string): VersionSnapshot;
  getVersions(): VersionSnapshot[];
  getVersion(id: string): VersionSnapshot | null;
  deleteVersion(id: string): VersionSnapshot | null;
  restoreVersion(id: string, opts?: any): boolean;
  compareVersions(vA: string, vB?: string): VersionComparisonResult;
  getComparisonList(): ComparisonListItem[];
  showVersionHistory(): void;
  showVersionComparison(vA?: string | null, vB?: string): void;
  getComments(filter?: { resolved?: boolean }): CommentItem[];
  setComments(c: CommentItem[]): CommentItem[];
  addComment(text: string): CommentItem | void;
  replyComment(commentId: string, text: string, user?: CollabUser | null): CommentReply | null;
  deleteCommentReply(commentId: string, replyId: string): CommentReply | boolean;
  resolveComment(id: string, resolvedBy?: string | null): CommentItem | null;
  deleteComment(id: string): CommentItem | boolean;
  clearAllAnnotations(): ClearAnnotationsAudit;
  clearCommentsAndSuggestions(): ClearAnnotationsAudit;
  getSuggestions(filter?: { status?: 'pending' | 'accepted' | 'rejected' }): SuggestionItem[];
  setSuggestions(s: SuggestionItem[]): SuggestionItem[];
  acceptSuggestion(id: string, reviewer?: CollabUser | null): SuggestionItem | null;
  rejectSuggestion(id: string, reviewer?: CollabUser | null): SuggestionItem | null;
  getUsers(): CollabUser[];
  setUsers(u: CollabUser[]): CollabUser[];
  setUser(u: string | CollabUser): CollabUser;
  setReadOnly(ro?: boolean): boolean;
  isReadOnly(): boolean;
  exportDOCX(filename?: string): void;
  exportMarkdown(filename?: string): void;
  exportHTML(filename?: string): void;
  exportJSON(filename?: string, full?: boolean): void;
  exportContextJSON(filename?: string): void;
  exportText(filename?: string): void;
  importDocument(file: File | Blob, options?: ImportDocumentOptions): Promise<string | null>;
  disconnectCollab(): void;
  connectCollab(url?: string): void;
  isCollabConnected(): boolean;
  setLayout(layout: PageLayout): void;
  focus(): void;
  addNewPage(): HTMLElement;
  insertPageAt(targetPageNumber: number, initialHtml?: string): HTMLElement;
  insertPageAfter(pageNumber: number, initialHtml?: string): HTMLElement;
  insertPageBefore(pageNumber: number, initialHtml?: string): HTMLElement;
  removePage(pageNumber: number): boolean;
  movePage(fromPageNumber: number, toPageNumber: number): boolean;
  movePageUp(pageNumber: number): boolean;
  movePageDown(pageNumber: number): boolean;
  reorderPages(newOrder: number[]): boolean;
  getPageCount(): number;
  getPage(pageNumber: number): HTMLElement | null;
  getPageHTML(pageNumber: number): string;
  setPageHTML(pageNumber: number, html: string): boolean;
}

export declare const RichTextEditor: DefineComponent<RichEditorOptions, {}, any, {}, RichTextEditorInstance>;
export { RichTextEditor as RichEditor };
export default RichTextEditor;
`
);

// Angular types
fs.writeFileSync(
  path.join(distAngularDir, 'index.d.ts'),
  `import { ElementRef, OnInit, OnDestroy } from '@angular/core';
import { 
  RichEditor, 
  DocumentContextBundle, 
  VersionSnapshot, 
  VersionComparisonResult, 
  ComparisonListItem, 
  CommentItem, 
  CommentReply,
  SuggestionItem, 
  CollabUser, 
  PageLayout, 
  EditorStats,
  ClearAnnotationsAudit,
  ImportDocumentOptions
} from '../types/index';

export declare class RichTextEditorComponent implements OnInit, OnDestroy {
  constructor(elementRef: ElementRef);
  ngOnInit(): void;
  ngOnDestroy(): void;
  writeValue(value: any): void;
  registerOnChange(fn: any): void;
  registerOnTouched(fn: any): void;
  setDisabledState(isDisabled: boolean): void;
  getInstance(): RichEditor | null;
  getHTML(): string;
  setHTML(html: string): void;
  getMarkdown(): string;
  setMarkdown(md: string): void;
  getJSON(): any;
  getText(): string;
  getData(): DocumentContextBundle;
  setData(bundle: Partial<DocumentContextBundle>): boolean;
  getDocumentContext(): DocumentContextBundle;
  setDocumentContext(bundle: Partial<DocumentContextBundle>): boolean;
  saveVersion(title?: string, desc?: string): VersionSnapshot;
  getVersions(): VersionSnapshot[];
  getVersion(id: string): VersionSnapshot | null;
  deleteVersion(id: string): VersionSnapshot | null;
  restoreVersion(id: string, opts?: any): boolean;
  compareVersions(vA: string, vB?: string): VersionComparisonResult;
  getComparisonList(): ComparisonListItem[];
  showVersionHistory(): void;
  showVersionComparison(vA?: string | null, vB?: string): void;
  getComments(filter?: { resolved?: boolean }): CommentItem[];
  setComments(c: CommentItem[]): CommentItem[];
  addComment(text: string): CommentItem | void;
  replyComment(commentId: string, text: string, user?: CollabUser | null): CommentReply | null;
  deleteCommentReply(commentId: string, replyId: string): CommentReply | boolean;
  resolveComment(id: string, resolvedBy?: string | null): CommentItem | null;
  deleteComment(id: string): CommentItem | boolean;
  clearAllAnnotations(): ClearAnnotationsAudit;
  clearCommentsAndSuggestions(): ClearAnnotationsAudit;
  getSuggestions(filter?: { status?: 'pending' | 'accepted' | 'rejected' }): SuggestionItem[];
  setSuggestions(s: SuggestionItem[]): SuggestionItem[];
  acceptSuggestion(id: string, reviewer?: CollabUser | null): SuggestionItem | null;
  rejectSuggestion(id: string, reviewer?: CollabUser | null): SuggestionItem | null;
  getUsers(): CollabUser[];
  setUsers(u: CollabUser[]): CollabUser[];
  setUser(u: string | CollabUser): CollabUser;
  setReadOnly(ro?: boolean): boolean;
  isReadOnly(): boolean;
  exportDOCX(filename?: string): void;
  exportMarkdown(filename?: string): void;
  exportHTML(filename?: string): void;
  exportJSON(filename?: string, full?: boolean): void;
  exportContextJSON(filename?: string): void;
  exportText(filename?: string): void;
  importDocument(file: File | Blob, options?: ImportDocumentOptions): Promise<string | null>;
  disconnectCollab(): void;
  connectCollab(url?: string): void;
  isCollabConnected(): boolean;
  setLayout(layout: PageLayout): void;
  focus(): void;
  addNewPage(): HTMLElement;
  insertPageAt(targetPageNumber: number, initialHtml?: string): HTMLElement;
  insertPageAfter(pageNumber: number, initialHtml?: string): HTMLElement;
  insertPageBefore(pageNumber: number, initialHtml?: string): HTMLElement;
  removePage(pageNumber: number): boolean;
  movePage(fromPageNumber: number, toPageNumber: number): boolean;
  movePageUp(pageNumber: number): boolean;
  movePageDown(pageNumber: number): boolean;
  reorderPages(newOrder: number[]): boolean;
  getPageCount(): number;
  getPage(pageNumber: number): HTMLElement | null;
  getPageHTML(pageNumber: number): string;
  setPageHTML(pageNumber: number, html: string): boolean;
}
export { RichTextEditorComponent as RichEditor, RichTextEditorComponent as RichTextEditor };
export default RichTextEditorComponent;
`
);

// Also copy CSS to dist root if not already there
const srcCss = path.join(rootDir, 'src', 'styles', 'richtext-all.css');
const distCss = path.join(rootDir, 'dist', 'richtext-all.css');
if (fs.existsSync(srcCss)) {
  fs.copyFileSync(srcCss, distCss);
}

console.log('✅ Type definitions and CSS copied to dist successfully.');
