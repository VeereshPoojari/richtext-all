export type PageLayout = 'infinite' | 'a4' | 'letter' | 'legal';

export interface EditorStats {
  words: number;
  chars: number;
}

export interface CollabUser {
  id: string;
  name: string;
  color?: string;
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
  collab?: CollabOptions | null;
  sync?: SyncOptions | null;
  onChange?: (html: string, stats: EditorStats) => void;
  onSelectionChange?: () => void;
}

export declare class EditorCore {
  el: HTMLElement;
  options: any;
  history: any;
  constructor(el: HTMLElement, options?: any);
  exec(cmd: string, value?: any): void;
  getHTML(): string;
  setHTML(html: string): void;
  getMarkdown(): string;
  setMarkdown(md: string): void;
  getText(): string;
  getStats(): EditorStats;
  setPageLayout(layout: PageLayout): void;
  addNewPage(): HTMLElement;
  removePage(pageNumber: number): void;
  focus(): void;
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
  constructor(editor: EditorCore, options?: CollabOptions);
  mount(containerEl: HTMLElement): void;
  destroy(): void;
}

export declare class SyncAdapter {
  editor: EditorCore;
  constructor(editor: EditorCore, options?: SyncOptions);
  saveToServer(payload?: any): Promise<any>;
  getJSON(): any;
  exportHTML(filename?: string): void;
  exportMarkdown(filename?: string): void;
  exportJSON(filename?: string): void;
  exportText(filename?: string): void;
  exportDOCX(filename?: string): void;
  destroy(): void;
}

export declare class RichEditor {
  core: EditorCore;
  toolbar: Toolbar | null;
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
  exportDOCX(filename?: string): void;
  exportMarkdown(filename?: string): void;
  exportHTML(filename?: string): void;
  exportJSON(filename?: string): void;
  exportText(filename?: string): void;
  importDocument(file: File | Blob): Promise<string>;
  browseAndOpen(): Promise<{ file: File; html: string }>;
  addNewPage(): HTMLElement;
  removePage(pageNumber: number): void;
  focus(): void;
  blur(): void;
  on(event: string, fn: Function): void;
  off(event: string, fn: Function): void;
  destroy(): void;
}

export declare function escapeHtml(str: string): string;
export declare function sanitizeUrl(url: string): string;
export declare function readDocumentFile(file: File | Blob): Promise<string>;
export declare function parseDocxFile(fileOrBlob: File | Blob): Promise<string>;

export default RichEditor;
