export type PageLayout = 'infinite' | 'a4' | 'letter' | 'legal';

export interface EditorStats {
  words: number;
  chars: number;
}

export interface CollabUser {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
}

export interface CollabOptions {
  serverUrl?: string | null;
  roomId?: string;
  user?: CollabUser;
}

export interface SyncOptions {
  endpoint?: string | null;
  method?: 'POST' | 'PUT';
  autoSave?: boolean;
  autoSaveInterval?: number;
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  onSave?: (result: any, payload: any) => void;
  onError?: (err: Error) => void;
  onStatusChange?: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export type GutterPosition = 'right' | 'left' | 'both';

export interface ToolbarDefaults {
  style?: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote' | 'codeBlock';
  fontSize?: string | number;
  lineHeight?: string | number;
  color?: string;
  highlight?: string;
  layout?: PageLayout;
  margin?: GutterPosition;
  gutterPosition?: GutterPosition;
  mode?: 'editing' | 'viewing' | 'suggesting' | 'comments' | 'version-history' | 'version-comparison';
  tableRows?: number;
  tableCols?: number;
}

export interface ToolbarOptions {
  visible?: boolean;
  sticky?: boolean;
  defaults?: ToolbarDefaults;
  show?: Record<string, boolean>;
  hiddenItems?: string[];
  hidden?: string[];
  items?: string[];
}

export interface CommentReply {
  id: string;
  text: string;
  author: string;
  authorId?: string;
  authorColor?: string;
  timestamp?: string;
  createdAt?: string;
}

export interface CommentItem {
  id: string;
  text: string;
  author: string;
  authorId?: string;
  authorColor?: string;
  timestamp?: string;
  resolved?: boolean;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  quote?: string;
  pageNumber?: number;
  rect?: any;
  replies?: CommentReply[];
}

export interface SuggestionReviewer {
  id?: string;
  name: string;
  color?: string;
}

export interface SuggestionItem {
  id: string;
  type: 'add' | 'del';
  text: string;
  quote?: string;
  author: string;
  authorId?: string;
  authorColor?: string;
  timestamp?: string;
  status?: 'pending' | 'accepted' | 'rejected';
  reviewedBy?: SuggestionReviewer | null;
  reviewedAt?: string | null;
}

export interface ClearAnnotationsAudit {
  deletedComments: CommentItem[];
  deletedSuggestions: SuggestionItem[];
  totalComments: number;
  totalSuggestions: number;
  timestamp: string;
}

export interface ImportDocumentOptions {
  confirmOnOverwrite?: boolean;
  onConfirmOverwrite?: (details: {
    file: File | Blob;
    commentsCount: number;
    suggestionsCount: number;
    comments: CommentItem[];
    suggestions: SuggestionItem[];
  }) => boolean | Promise<boolean>;
}

export interface VersionSnapshot {
  id: string;
  title: string;
  description?: string;
  author?: string;
  authorId?: string;
  timestamp: string;
  html: string;
  text?: string;
  wordCount?: number;
  isLive?: boolean;
}

export interface VersionDiffStats {
  additions: number;
  deletions: number;
  totalChanges: number;
}

export interface VersionComparisonResult {
  versionA: VersionSnapshot;
  versionB: VersionSnapshot;
  leftHtml: string;
  rightHtml: string;
  unifiedHtml: string;
  stats: VersionDiffStats;
}

export interface ComparisonListItem {
  version: VersionSnapshot;
  previousVersionId: string | null;
  stats: VersionDiffStats | null;
}

export interface DocumentMetadata {
  title: string;
  author: string;
  authorId: string;
  authorColor?: string;
  createdAt: string;
  updatedAt: string;
  stats: EditorStats;
}

export interface DocumentSettings {
  pageLayout: PageLayout;
  gutterPosition: GutterPosition;
  mode: string;
  readOnly: boolean;
}

export interface DocumentContent {
  html: string;
  text: string;
  markdown: string;
  json: any;
}

export interface DocumentContextBundle {
  schemaVersion: string;
  exportedAt: string;
  metadata: DocumentMetadata;
  settings: DocumentSettings;
  content: DocumentContent;
  comments: CommentItem[];
  suggestions: SuggestionItem[];
  versions: VersionSnapshot[];
  comparisonList: ComparisonListItem[];
  users: CollabUser[];
  [key: string]: any;
}

export interface RichEditorOptions {
  initialContent?: string;
  placeholder?: string;
  pageLayout?: PageLayout;
  gutterPosition?: GutterPosition;
  readOnly?: boolean;
  toolbar?: boolean | ToolbarOptions;
  toolbarDefaults?: ToolbarDefaults;
  bubbleMenu?: boolean;
  slashCommand?: boolean;
  splitView?: boolean;
  statusBar?: boolean;
  user?: CollabUser;
  collab?: CollabOptions | null;
  sync?: SyncOptions | null;
  onChange?: (html: string, stats: EditorStats) => void;
  onSelectionChange?: () => void;
}

export declare class EditorCore {
  el: HTMLElement;
  options: any;
  history: any;
  comments: CommentItem[];
  suggestions: SuggestionItem[];
  versions: VersionSnapshot[];
  users: CollabUser[];
  constructor(el: HTMLElement, options?: any);
  exec(cmd: string, value?: any): void;
  getHTML(): string;
  setHTML(html: string): void;
  getMarkdown(): string;
  setMarkdown(md: string): void;
  getText(): string;
  getJSON(): any;
  getStats(): EditorStats;
  setPageLayout(layout: PageLayout): void;
  setGutterPosition(position: GutterPosition): string;
  getGutterPosition(): GutterPosition;
  toggleGutterPosition(): GutterPosition;
  setReadOnly(readOnly?: boolean): boolean;
  isReadOnly(): boolean;
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
  focus(): void;
  
  // Document Context & Data Access
  getDocumentContext(): DocumentContextBundle;
  getData(): DocumentContextBundle;
  setDocumentContext(bundle: Partial<DocumentContextBundle>): boolean;
  setData(bundle: Partial<DocumentContextBundle>): boolean;

  // Version Control & Auditing
  saveVersion(title?: string, description?: string, options?: any): VersionSnapshot;
  saveVersionSnapshot(title?: string, description?: string, options?: any): VersionSnapshot;
  getVersions(): VersionSnapshot[];
  setVersions(versions: VersionSnapshot[]): VersionSnapshot[];
  getVersion(id: string): VersionSnapshot | null;
  deleteVersion(id: string): VersionSnapshot | null;
  restoreVersion(id: string, options?: any): boolean;
  compareVersions(versionIdA: string, versionIdB?: string): VersionComparisonResult;
  getComparisonList(): ComparisonListItem[];
  showVersionHistory(): void;
  showVersionComparison(versionIdA?: string | null, versionIdB?: string): void;

  // Comments & Suggestions
  getComments(filter?: { resolved?: boolean }): CommentItem[];
  setComments(comments: CommentItem[]): CommentItem[];
  addComment(text: string): CommentItem | void;
  replyComment(commentId: string, text: string, user?: CollabUser | null): CommentReply | null;
  deleteCommentReply(commentId: string, replyId: string): CommentReply | boolean;
  resolveComment(id: string, resolvedBy?: string | null): CommentItem | null;
  deleteComment(id: string): CommentItem | boolean;
  getSuggestions(filter?: { status?: 'pending' | 'accepted' | 'rejected' }): SuggestionItem[];
  setSuggestions(suggestions: SuggestionItem[]): SuggestionItem[];
  acceptSuggestion(id: string, reviewer?: CollabUser | null): SuggestionItem | null;
  rejectSuggestion(id: string, reviewer?: CollabUser | null): SuggestionItem | null;

  // User Management
  getUsers(): CollabUser[];
  setUsers(users: CollabUser[]): CollabUser[];
  getUser(id: string): CollabUser | null;
  setUser(userOrId: string | CollabUser): CollabUser;
  addUser(name: string, color?: string | null): CollabUser;
  getCurrentUser(): CollabUser;

  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, ...args: any[]): void;
  destroy(): void;
}

export declare class Toolbar {
  editor: any;
  element: HTMLElement | null;
  visible: boolean;
  defaults: ToolbarDefaults;
  constructor(editor: any, options?: ToolbarOptions);
  mount(containerEl?: HTMLElement): void;
  show(): this;
  hide(): this;
  toggle(forceState?: boolean): this;
  isVisible(): boolean;
  showItem(key: string): this;
  hideItem(key: string): this;
  toggleItem(key: string, forceState?: boolean): this;
  isItemVisible(key: string): boolean;
  setItemVisibility(key: string, visible: boolean): this;
  setItemsVisibility(config?: Record<string, boolean>): this;
  getDefaults(): ToolbarDefaults;
  setDefaults(newDefaults?: Partial<ToolbarDefaults>): ToolbarDefaults;
  destroy(): void;
}

export declare class BubbleMenu {
  core: EditorCore;
  constructor(core: EditorCore);
  mount(containerEl: HTMLElement): void;
  destroy(): void;
}

export declare class SlashCommand {
  core: EditorCore;
  constructor(core: EditorCore);
  mount(containerEl: HTMLElement): void;
  destroy(): void;
}

export declare class SplitView {
  core: EditorCore;
  constructor(core: EditorCore);
  mount(containerEl: HTMLElement): void;
  destroy(): void;
}

export declare class CollabEngine {
  editor: EditorCore;
  isConnected: boolean;
  constructor(editor: EditorCore, options?: CollabOptions);
  mount(containerEl: HTMLElement): void;
  connect(serverUrl?: string): void;
  disconnect(): void;
  setUser(user: CollabUser): void;
  destroy(): void;
}

export declare class SyncAdapter {
  editor: EditorCore;
  constructor(editor: EditorCore, options?: SyncOptions);
  saveToServer(payload?: any): Promise<any>;
  getJSON(): any;
  exportHTML(filename?: string): void;
  exportMarkdown(filename?: string): void;
  exportJSON(filename?: string, fullContext?: boolean): void;
  exportContextJSON(filename?: string): void;
  exportText(filename?: string): void;
  exportDOCX(filename?: string): void;
  destroy(): void;
}

export declare class RichEditor {
  core: EditorCore;
  toolbar: Toolbar | null;
  collab: CollabEngine | null;
  sync: SyncAdapter | null;
  constructor(target: string | HTMLElement, options?: RichEditorOptions);
  getHTML(): string;
  setHTML(html: string): void;
  getMarkdown(): string;
  setMarkdown(md: string): void;
  getJSON(): any;
  getText(): string;
  getStats(): EditorStats;
  setLayout(layout: PageLayout): void;
  setGutterPosition(position: GutterPosition): string;
  getGutterPosition(): GutterPosition;
  toggleGutterPosition(): GutterPosition;
  setReadOnly(readOnly?: boolean): boolean;
  isReadOnly(): boolean;

  // Complete Document Context & Data Access
  getData(): DocumentContextBundle;
  setData(bundle: Partial<DocumentContextBundle>): boolean;
  getDocumentContext(): DocumentContextBundle;
  setDocumentContext(bundle: Partial<DocumentContextBundle>): boolean;

  // Version Control & Comparison
  saveVersion(title?: string, description?: string): VersionSnapshot;
  getVersions(): VersionSnapshot[];
  getVersion(id: string): VersionSnapshot | null;
  deleteVersion(id: string): VersionSnapshot | null;
  restoreVersion(id: string, options?: any): boolean;
  compareVersions(versionIdA: string, versionIdB?: string): VersionComparisonResult;
  getComparisonList(): ComparisonListItem[];
  showVersionHistory(): void;
  showVersionComparison(versionIdA?: string | null, versionIdB?: string): void;

  // Comments & Suggestions
  getComments(filter?: { resolved?: boolean }): CommentItem[];
  setComments(comments: CommentItem[]): CommentItem[];
  addComment(text: string): CommentItem | void;
  openCommentDraft(): void;
  cancelCommentDraft(): void;
  submitCommentDraft(text: string): void;
  replyComment(commentId: string, text: string, user?: CollabUser | null): CommentReply | null;
  deleteCommentReply(commentId: string, replyId: string): CommentReply | boolean;
  resolveComment(id: string, resolvedBy?: string | null): CommentItem | null;
  deleteComment(id: string): CommentItem | boolean;
  clearAllAnnotations(): ClearAnnotationsAudit;
  clearCommentsAndSuggestions(): ClearAnnotationsAudit;
  getSuggestions(filter?: { status?: 'pending' | 'accepted' | 'rejected' }): SuggestionItem[];
  setSuggestions(suggestions: SuggestionItem[]): SuggestionItem[];
  acceptSuggestion(id: string, reviewer?: CollabUser | null): SuggestionItem | null;
  rejectSuggestion(id: string, reviewer?: CollabUser | null): SuggestionItem | null;

  // Users & Presence
  getUsers(): CollabUser[];
  setUsers(users: CollabUser[]): CollabUser[];
  getCurrentUser(): CollabUser;
  setUser(userOrId: string | CollabUser): CollabUser;
  addUser(name: string, color?: string | null): CollabUser;
  promptAddUser(): CollabUser | null;

  // Toolbar
  showToolbar(): this;
  hideToolbar(): this;
  toggleToolbar(forceVisible?: boolean): this;
  isToolbarVisible(): boolean;
  showToolbarItem(key: string): this;
  hideToolbarItem(key: string): this;
  toggleToolbarItem(key: string, forceVisible?: boolean): this;
  isToolbarItemVisible(key: string): boolean;
  setToolbarItemVisibility(key: string, visible: boolean): this;
  setToolbarItemsVisibility(itemsMap: Record<string, boolean>): this;
  setToolbarDefaults(defaults: Partial<ToolbarDefaults>): ToolbarDefaults;
  getToolbarDefaults(): ToolbarDefaults;
  toggleSplitView(): void;

  // Import & Export
  exportDOCX(filename?: string): void;
  exportMarkdown(filename?: string): void;
  exportHTML(filename?: string): void;
  exportJSON(filename?: string, fullContext?: boolean): void;
  exportContextJSON(filename?: string): void;
  exportText(filename?: string): void;
  importDocument(file: File | Blob, options?: ImportDocumentOptions): Promise<string | null>;
  browseAndOpen(options?: ImportDocumentOptions): Promise<{ file: File; html: string } | null>;

  // Real-Time Collab
  disconnectCollab(): void;
  connectCollab(serverUrl?: string): void;
  isCollabConnected(): boolean;

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
  focus(): void;
  blur(): void;
  on(event: string, fn: Function): void;
  off(event: string, fn: Function): void;
  emit(event: string, payload?: any): void;
  destroy(): void;
}

export declare function escapeHtml(str: string): string;
export declare function sanitizeUrl(url: string): string;
export declare function readDocumentFile(file: File | Blob): Promise<string>;
export declare function parseDocxFile(fileOrBlob: File | Blob): Promise<string>;

export default RichEditor;
