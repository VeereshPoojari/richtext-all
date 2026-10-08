# ✍️ RichText-All

> **The Universal, Zero-Dependency Collaborative Rich Text & Document Editor Engine**  
> One unified API across **React**, **Next.js**, **Vue 3**, **Angular**, **Svelte**, and **Vanilla HTML5**.

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/package/richtext-all)
[![Bundle Size](https://img.shields.io/badge/bundle-24KB%20(gzipped)-emerald.svg)](#)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0%20runtime-brightgreen.svg)](#)
[![Multi-Platform](https://img.shields.io/badge/platforms-React%20%7C%20Vue%20%7C%20Angular%20%7C%20Svelte%20%7C%20HTML5-purple.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Demo](https://img.shields.io/badge/demo-interactive%20live%20playground-gradient.svg)](https://veereshpoojari.github.io/richtext-all/)

---

## 🌐 Live Interactive Demo
Try **RichText-All** directly in your browser:  
👉 **[Open Live Demo Playground](https://veereshpoojari.github.io/richtext-all/)**  
*(Experience print-accurate A4 pagination, 3D card clustering, bilateral margin arrangement, version checkpoints with visual diffs, and 1-click DOCX import/export)*

---

## 🚀 Why RichText-All?

| Feature | **RichText-All** 🌟 | TipTap | Quill | Slate | TinyMCE / CKEditor |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Multi-Framework** | **React, Vue, Angular, Svelte, Vanilla** | React & Vue only | Vanilla primarily | React only | Multi-framework |
| **Page Pagination** | **Print-accurate A4, Letter, Legal, Web** | ❌ No | ❌ No | ❌ No | Paid Plugin |
| **Annotation Card Clustering** | **3D Deck Stacking + Hover Fan-Out** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Bilateral Margins** | **Left, Right, or Auto Both Sides** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Track Changes & Suggestions** | **Built-in Additions & Deletions** | Paid Cloud | ❌ No | ❌ No | Enterprise Paid |
| **Version History & Visual Diff** | **Word-by-word Side-by-side & Unified** | Paid Cloud | ❌ No | ❌ No | Enterprise Paid |
| **Live Split Editor** | **Bidirectional Markdown <-> WYSIWYG** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Native Word DOCX Import** | **Built-in Zero-Dependency Parser** | Plugins required | ❌ No | ❌ No | Paid Plugins |
| **Zero Runtime Dependencies** | **0 Dependencies (~24 KB)** | 20+ packages | 5+ packages | 10+ packages | Heavy (>150 KB) |

---

## 📦 Installation

```bash
npm install richtext-all
```

Or via CDN:
```html
<link rel="stylesheet" href="https://unpkg.com/richtext-all@1.0.0/dist/richtext-all.css">
<script type="module" src="https://unpkg.com/richtext-all@1.0.0/dist/index.esm.js"></script>
```

---

## 💡 Flagship Features

### 1. 📄 Print-Accurate Physical Page Layouts & Auto-Pagination
- Switch between **A4** (210×297mm), **US Letter** (8.5×11in), **US Legal** (8.5×14in), and **Web (Infinite 100%)**.
- **Real-Time Continuous Typing Auto-Pagination**: As text, images, or tables exceed page height budgets, overflow elements automatically advance to the next page sheet without splitting words awkwardly or breaking paragraph integrity.
- Page numbering pills (`Page 1`, `Page 2`, ...) and insert/delete page breaks with one click.

### 2. 📚 Position-Based Card Clustering & 3D Deck Stacking
- **Vertical Proximity Clustering**: When multiple annotations (comments, suggestions, deletions) are created on the same line or within $50\text{px}$, they group into a single compact line cluster anchored to the text.
- **Collapsed 3D Deck Stack**: Displays the top card with a pill badge (`📚 N items on this line`) and stacks subsequent cards with layered 3D depth and subtle vertical offsets.
- **Hover Fan-Out / Spread**: Hovering the card cluster smoothly expands all cards vertically with dynamically accumulated heights and non-overlapping $12\text{px}$ spacing.
- **Top-Layer Elevation**: Hovering over marked phrases in the document body immediately pops that exact card to the **top layer** (`z-index: 300`, elevated 3D shadow, and author's color border).

### 3. ⇋ Bilateral Margin Space Arrangement (`left`, `right`, `both`)
- **`'right'`**: All cards occupy the right margin space.
- **`'left'`**: All cards occupy the left margin space.
- **`'both'` (Automatic Bilateral)**: Activates both left and right margin spaces:
  - Single annotations on a line occupy their closest margin space.
  - Two annotations on the same line automatically occupy opposite sides (one on Left, one on Right), giving each card full visibility without clustering!
  - When line space on both margins is filled (3+ items), subsequent annotations form balanced card stacks on both sides.

### 4. ⚖️ Version History Checkpoints & Word-by-Word Visual Diff
- Save manual checkpoints and automated snapshots with word count and author stamps.
- Interactive **Visual Diff Visualizer Modal**:
  - Compare any past checkpoint against another or the **Live Active Document**.
  - **Side-by-Side Split View** with synchronized scrolling.
  - **Unified View** showing deletions in red strike-through (`-Red`) and additions in green underline (`+Green`).
  - One-click rollback to restore any previous document revision.

### 5. 👥 Collaborator Identity & User Switcher
- Assign each team member a distinct name and author color.
- Dropdown user switcher with custom color picker dialog (`+ User`).
- Metadata persists across all comments, suggestions, and cursor badges.

### 6. 📂 Native Word (.docx) Import & Export
- Drag and drop or browse `.docx` files to parse and edit directly in the browser.
- Handcrafted XML reader parses `word/document.xml` preserving headings, paragraphs, bold, italic, lists, and tables without external dependencies.
- Export clean `.docx`, `.md`, `.html`, `.json`, and plain `.txt` files.

### 7. 🎛️ Fully Configurable Toolbar: Defaults & Granular Show/Hide
- **Customizable Default Values**: Set defaults for every toolbar control on initialization or at runtime (`style`, `fontSize`, `lineHeight`, `color`, `highlight`, `layout`, `margin`, `mode`, `tableRows`, `tableCols`).
- **Complete Toolbar Visibility**: Toggle the entire ribbon with `editor.hideToolbar()` / `editor.showToolbar()` or initialize with `toolbar: false` or `toolbar: { visible: false }`.
- **Granular Item Visibility**: Show or hide specific buttons, dropdowns, or feature groups with `hiddenItems: ['upload', 'table']`, `show: { mode: false }`, or whitelist with `items: ['style', 'bold', 'italic']`.
- **Dynamic Runtime Controls**: Freely call `editor.hideToolbarItem(key)`, `editor.showToolbarItem(key)`, `editor.toggleToolbarItem(key)`, or `editor.setToolbarDefaults(defaults)`.
- **Automatic Group & Divider Management**: Dividers and empty groups cleanly auto-collapse when child items are hidden.

---

## 🛠️ Framework Integration

### 1. React / Next.js (App Router & Pages Router)

```jsx
import React, { useRef } from 'react';
import { RichEditor } from 'richtext-all/react';
import 'richtext-all/css';

export default function DocumentEditor() {
  const editorRef = useRef(null);

  return (
    <div style={{ height: '90vh', maxWidth: '1200px', margin: '0 auto' }}>
      <RichEditor
        ref={editorRef}
        pageLayout="a4"              // 'a4' | 'letter' | 'legal' | 'infinite'
        gutterPosition="both"        // 'right' | 'left' | 'both'
        user={{
          id: 'usr-1',
          name: 'Sarah (Design Lead)',
          color: '#ec4899'
        }}
        onSave={(data) => {
          console.log('Document HTML:', data.html);
          console.log('Markdown:', data.markdown);
        }}
      />
    </div>
  );
}
```

### 2. Vue 3 / Nuxt 3

```vue
<template>
  <div class="editor-container">
    <RichEditor
      v-model="content"
      page-layout="a4"
      gutter-position="both"
      :user="{ id: 'usr-2', name: 'Alex (Tech Lead)', color: '#059669' }"
      @change="onContentChange"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { RichEditor } from 'richtext-all/vue';
import 'richtext-all/css';

const content = ref('<h1>Project Overview</h1><p>Collaborate in real time!</p>');
const onContentChange = (stats) => {
  console.log('Word count:', stats.words);
};
</script>
```

### 3. Angular (12+)

```typescript
import { Component } from '@angular/core';
import { RichEditorComponent } from 'richtext-all/angular';

@Component({
  selector: 'app-document-view',
  standalone: true,
  imports: [RichEditorComponent],
  template: `
    <rich-editor
      [pageLayout]="'a4'"
      [gutterPosition]="'both'"
      (onSave)="handleSave($event)">
    </rich-editor>
  `
})
export class DocumentViewComponent {
  handleSave(doc: any) {
    console.log('Saved document HTML:', doc.html);
  }
}
```

### 4. Vanilla JavaScript / HTML5

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="node_modules/richtext-all/dist/richtext-all.css">
</head>
<body>
  <div id="editor-mount"></div>

  <script type="module">
    import { RichEditor } from 'richtext-all';

    const editor = new RichEditor('#editor-mount', {
      pageLayout: 'a4',
      gutterPosition: 'both',
      user: { name: 'Veeresh', color: '#6366f1' }
    });

    // Programmatic Margin Space API
    editor.setGutterPosition('left');  // Switch to left margin
    editor.setGutterPosition('right'); // Switch to right margin
    editor.setGutterPosition('both');  // Automatic bilateral margin distribution

    // Checkpoints & Diff
    editor.saveVersion('First Milestone Draft');
  </script>
</body>
</html>
```

---

## 📖 API Reference

### Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `pageLayout` | `'a4' \| 'letter' \| 'legal' \| 'infinite'` | `'a4'` | Document page format with auto-pagination. |
| `gutterPosition` | `'right' \| 'left' \| 'both'` | `'right'` | Annotation margin space placement mode. |
| `toolbar` | `boolean \| object` | `true` | Full toolbar configuration: `{ visible, defaults, show, hiddenItems, items }`. |
| `toolbarDefaults` | `object` | `{}` | Shortcut for default values (`style`, `fontSize`, `lineHeight`, etc.). |
| `user` | `{ id, name, color }` | Author | Active user credentials and highlight color. |
| `users` | `Array<{ id, name, color }>` | Default list | Pre-populated team collaborators. |
| `placeholder` | `string` | `'Write something...'` | Watermark text displayed on empty pages. |
| `readOnly` | `boolean` | `false` | Locks document editing. |
| `autoFocus` | `boolean` | `false` | Focuses the first page on load. |

### Toolbar Customization & Default Values

```javascript
import { RichEditor } from 'richtext-all';

const editor = new RichEditor('#editor', {
  pageLayout: 'a4',
  toolbar: {
    visible: true,               // Set false to start with toolbar completely hidden
    defaults: {
      style: 'p',                // 'p' | 'h1'-'h6' | 'blockquote' | 'codeBlock'
      fontSize: '16',            // '12' | '14' | '16' | '18' | '20' | '24' | '32'
      lineHeight: '1.6',         // '1.0' | '1.2' | '1.4' | '1.5' | '1.6' | '2.0'
      color: '#0f172a',          // Default text color hex
      highlight: '#facc15',      // Default highlight swatch color hex
      layout: 'a4',              // 'a4' | 'letter' | 'legal' | 'infinite'
      margin: 'right',           // 'right' | 'left' | 'both'
      mode: 'editing',           // 'editing' | 'viewing' | 'suggesting' | 'comments'
      tableRows: 3,              // Default rows in table insertion modal
      tableCols: 3               // Default columns in table insertion modal
    },
    // Hide specific buttons or feature groups on load:
    hiddenItems: ['upload', 'table', 'mode'],
    // Or selectively show/hide via map:
    show: {
      upload: false,
      table: false
    }
  }
});
```

### Supported Toolbar Item Keys & Aliases

| Item Key | Group / Control | Aliases |
| :--- | :--- | :--- |
| `upload` | Open DOCX document button | `browse` |
| `history` | Undo & Redo group | `undoRedo` |
| `undo` / `redo` | Individual undo/redo buttons | — |
| `style` | Paragraph, H1-H6, Quote dropdown | `heading`, `headings` |
| `typography` | Font size & Line spacing group | `fonts` |
| `fontSize` | Font size select dropdown | `font` |
| `lineHeight` | Line spacing select dropdown | `lineSpacing`, `spacing` |
| `formatting` | B, I, U, S, Tx buttons group | — |
| `bold` / `italic` / `underline` | Individual format buttons | — |
| `strikeThrough` | Strikethrough button | `strikethrough` |
| `removeFormat` | Clear formatting (Tx) button | `clearFormatting`, `clearFormat`, `tx` |
| `colors` | Text & highlight color group | — |
| `color` | Text color picker | `textColor`, `pen` |
| `highlight` | Highlight background swatch | `bgColor`, `highlightColor`, `swatch` |
| `align` | Alignment buttons group | `alignment` |
| `list` | Bulleted & Numbered list group | `lists` |
| `insert` | Link, Image, Table group | — |
| `link` / `image` / `table` | Individual insert controls | — |
| `page` | Add Page & Layout group | — |
| `addPage` / `layout` | Add Page button / Layout select | `newPage`, `pageLayout` |
| `review` | Comment, Margin, Save Version group | — |
| `comment` | Add Comment button | `addComment`, `comments` |
| `margin` | Margin space dropdown (Right/Left/Both) | `gutter`, `gutterPos`, `gutterPosition` |
| `saveVersion` | Save Version checkpoint button | `versionHistory`, `saveVer`, `checkpoint` |
| `mode` | Document Mode dropdown | `documentMode` |
| `users` | Active user switcher & +User button | `user`, `collaborators` |

### Core Methods

| Method | Returns | Description |
| :--- | :--- | :--- |
| `editor.showToolbar()` | `RichEditor` | Shows the docked ribbon toolbar. |
| `editor.hideToolbar()` | `RichEditor` | Hides the docked ribbon toolbar. |
| `editor.toggleToolbar(force?)` | `RichEditor` | Toggles toolbar ribbon visibility. |
| `editor.isToolbarVisible()` | `boolean` | Returns `true` if toolbar is currently displayed. |
| `editor.showToolbarItem(key)` | `RichEditor` | Displays a specific toolbar item or group. |
| `editor.hideToolbarItem(key)` | `RichEditor` | Hides a specific toolbar item or group. |
| `editor.toggleToolbarItem(key, force?)` | `RichEditor` | Toggles visibility of a specific toolbar item. |
| `editor.isToolbarItemVisible(key)` | `boolean` | Returns whether the item is currently visible. |
| `editor.setToolbarItemVisibility(key, visible)` | `RichEditor` | Sets visibility of a single item or group. |
| `editor.setToolbarItemsVisibility(map)` | `RichEditor` | Batch sets visibility e.g. `{ upload: false, table: false }`. |
| `editor.setToolbarDefaults(defaults)` | `object` | Sets and applies default values (`fontSize`, `margin`, etc.). |
| `editor.getToolbarDefaults()` | `object` | Returns current toolbar default values. |
| `editor.setGutterPosition(pos)` | `string` | Sets margin space (`'left'`, `'right'`, or `'both'`). |
| `editor.getGutterPosition()` | `string` | Returns current margin space. |
| `editor.toggleGutterPosition()` | `string` | Cycles margin: `right` ➔ `left` ➔ `both` ➔ `right`. |
| `editor.setLayout(type)` | `void` | Changes page layout (`'a4'`, `'letter'`, `'legal'`, `'infinite'`). |
| `editor.addNewPage()` | `HTMLElement` | Appends a new physical page sheet. |
| `editor.removePage(pageNumber)` | `void` | Removes a page sheet. |
| `editor.saveVersion(title)` | `object` | Creates a named document snapshot. |
| `editor.restoreVersion(id)` | `void` | Restores document to a past checkpoint. |
| `editor.addUser(name, color)` | `object` | Registers and selects a new collaborator. |
| `editor.setUser(userOrId)` | `object` | Switches active author identity. |
| `editor.importDocument(file)` | `Promise<string>` | Imports `.docx`, `.doc`, `.md`, `.html`, or `.txt`. |
| `editor.browseAndOpen()` | `Promise<string>` | Prompts user file picker to open a document. |
| `editor.getHTML()` | `string` | Returns clean document HTML. |
| `editor.getMarkdown()` | `string` | Converts document to Markdown. |
| `editor.getJSON()` | `object` | Returns structured JSON AST. |
| `editor.getStats()` | `object` | Returns word count, character count, and reading time. |

---

## 🧪 Testing

Run the zero-dependency test suite covering security, pagination, card clustering, bilateral arrangement, and visual diffs:

```bash
npm test
```

---

## 📄 License

MIT © [Veeresh Poojari](https://github.com/VeereshPoojari).
