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
import { RichEditorOptions, RichEditor } from '../types/index';

export interface RichTextEditorProps extends RichEditorOptions {
  className?: string;
  style?: React.CSSProperties;
  onReady?: (editor: RichEditor) => void;
}

export declare const RichTextEditor: React.ForwardRefExoticComponent<
  RichTextEditorProps & React.RefAttributes<any>
>;

export declare function useRichEditor(
  ref: React.RefObject<HTMLElement>,
  options?: RichEditorOptions
): RichEditor | null;

export default RichTextEditor;
`
);

// Vue types
fs.writeFileSync(
  path.join(distVueDir, 'index.d.ts'),
  `import { DefineComponent } from 'vue';
import { RichEditorOptions, RichEditor } from '../types/index';

export declare const RichTextEditor: DefineComponent<RichEditorOptions, {}, any>;
export default RichTextEditor;
`
);

// Angular types
fs.writeFileSync(
  path.join(distAngularDir, 'index.d.ts'),
  `import { ElementRef, OnInit, OnDestroy } from '@angular/core';
import { RichEditor } from '../types/index';

export declare class RichTextEditorComponent implements OnInit, OnDestroy {
  constructor(elementRef: ElementRef);
  ngOnInit(): void;
  ngOnDestroy(): void;
  writeValue(value: any): void;
  registerOnChange(fn: any): void;
  registerOnTouched(fn: any): void;
  setDisabledState(isDisabled: boolean): void;
  getHTML(): string;
  setHTML(html: string): void;
  getMarkdown(): string;
  setMarkdown(md: string): void;
}
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
