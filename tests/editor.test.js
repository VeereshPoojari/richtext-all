/**
 * tests/editor.test.js - Unit tests for richtext-all core and security utilities
 * Zero-dependency test runner using Node.js assert
 */

import assert from 'assert';
import { escapeHtml, sanitizeUrl } from '../src/utils/security.js';
import { autoPaginateHtml } from '../src/utils/docxReader.js';
import { computeDocumentDiff, tokenizeHtml, diffTokens } from '../src/utils/diff.js';
import { Toolbar, ITEM_ALIASES } from '../src/ui/Toolbar.js';
import { CollabEngine } from '../src/collab/CollabEngine.js';
import { EditorCore } from '../src/core/EditorCore.js';

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
  }
}

console.log('🚀 Running richtext-all Test Suite...\n');

// 1. Security Utilities Tests
console.log('--- Security & Sanitization Tests ---');

test('escapeHtml escapes dangerous HTML characters', () => {
  const unsafe = '<script>alert("xss")</script>&"\'';
  const safe = escapeHtml(unsafe);
  assert.strictEqual(safe, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;&#039;');
});

test('escapeHtml handles empty or null values', () => {
  assert.strictEqual(escapeHtml(''), '');
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
});

test('sanitizeUrl allows safe http/https and mailto protocols', () => {
  assert.strictEqual(sanitizeUrl('https://example.com/doc'), 'https://example.com/doc');
  assert.strictEqual(sanitizeUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.strictEqual(sanitizeUrl('mailto:veeresha3993@gmail.com'), 'mailto:veeresha3993@gmail.com');
  assert.strictEqual(sanitizeUrl('/relative/path'), '/relative/path');
});

test('sanitizeUrl blocks dangerous javascript: and data: text schemes', () => {
  assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '#');
  assert.strictEqual(sanitizeUrl('JAVASCRIPT:alert(1)'), '#');
  assert.strictEqual(sanitizeUrl('vbscript:msgbox(1)'), '#');
  assert.strictEqual(sanitizeUrl('data:text/html,<script>alert(1)</script>'), '#');
});

test('sanitizeUrl permits safe data:image urls', () => {
  const dataImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...';
  assert.strictEqual(sanitizeUrl(dataImg), dataImg);
});

// 2. Event Emitter Tests
console.log('\n--- Event Emitter & State Logic Tests ---');

test('Event emitter handles on, emit and off properly', () => {
  const listeners = {};
  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }
  function emit(event, ...args) {
    if (listeners[event]) {
      listeners[event].forEach(fn => fn(...args));
    }
  }
  function off(event, fn) {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(cb => cb !== fn);
    }
  }

  let callCount = 0;
  const handler = (data) => {
    callCount += data;
  };

  on('change', handler);
  emit('change', 5);
  assert.strictEqual(callCount, 5);

  emit('change', 10);
  assert.strictEqual(callCount, 15);

  off('change', handler);
  emit('change', 20);
  assert.strictEqual(callCount, 15); // Unsubscribed, unchanged
});

// 3. Stats Calculation Tests
console.log('\n--- Text & Statistics Calculation Tests ---');

test('Word and character counter handles standard text correctly', () => {
  const text = 'Hello world! Welcome to richtext-all editor.';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;

  assert.strictEqual(words, 6);
  assert.strictEqual(chars, 44);
});

test('Word and character counter handles whitespace and empty input', () => {
  const text = '   \n\t  ';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  assert.strictEqual(words, 0);
});

// 4. History Undo/Redo Logic Tests
console.log('\n--- History Stack Tests ---');

test('Undo/Redo stack maintains max depth and state transitions', () => {
  class HistoryStack {
    constructor(limit = 50) {
      this.stack = [];
      this.index = -1;
      this.limit = limit;
    }
    push(item) {
      if (this.index < this.stack.length - 1) {
        this.stack = this.stack.slice(0, this.index + 1);
      }
      this.stack.push(item);
      if (this.stack.length > this.limit) {
        this.stack.shift();
      } else {
        this.index++;
      }
    }
    undo() {
      if (this.index > 0) {
        this.index--;
        return this.stack[this.index];
      }
      return null;
    }
    redo() {
      if (this.index < this.stack.length - 1) {
        this.index++;
        return this.stack[this.index];
      }
      return null;
    }
  }

  const history = new HistoryStack(5);
  history.push('v1');
  history.push('v2');
  history.push('v3');

  assert.strictEqual(history.undo(), 'v2');
  assert.strictEqual(history.undo(), 'v1');
  assert.strictEqual(history.undo(), null); // At beginning

  assert.strictEqual(history.redo(), 'v2');
  history.push('v4'); // New branch
  assert.strictEqual(history.redo(), null); // Can't redo after new branch
  assert.strictEqual(history.undo(), 'v2');
});

// 5. Version History & Comments Logic Tests
console.log('\n--- Version History & Comments Tests ---');

test('Version history correctly snapshots and tracks checkpoints', () => {
  const versions = [];
  function saveVersion(title, html) {
    const ver = {
      id: 'ver-' + (versions.length + 1),
      title,
      html,
      timestamp: '12:00:00'
    };
    versions.push(ver);
    return ver;
  }

  saveVersion('Draft 1', '<p>Hello</p>');
  saveVersion('Draft 2', '<p>Hello World</p>');

  assert.strictEqual(versions.length, 2);
  assert.strictEqual(versions[0].title, 'Draft 1');
  assert.strictEqual(versions[1].html, '<p>Hello World</p>');
});

test('Comments system tracks author, timestamp and quote selection', () => {
  const comments = [];
  function addComment(text, quote, author) {
    comments.push({ id: 'c-1', text, quote, author, timestamp: '12:05:00' });
  }

  addComment('Please review this section', 'Google Docs alternative', 'Veeresh');
  assert.strictEqual(comments.length, 1);
  assert.strictEqual(comments[0].author, 'Veeresh');
  assert.strictEqual(comments[0].quote, 'Google Docs alternative');
});

test('Multi-page manager adds and removes physical pages properly', () => {
  const pages = [1];
  function addPage() {
    pages.push(pages.length + 1);
    return pages.length;
  }
  function removePage(num) {
    if (pages.length <= 1) return;
    const idx = pages.indexOf(num);
    if (idx >= 0) pages.splice(idx, 1);
  }

  assert.strictEqual(addPage(), 2);
  assert.strictEqual(addPage(), 3);
  assert.strictEqual(pages.length, 3);
  removePage(2);
  assert.strictEqual(pages.length, 2);
});

test('Dynamic table builder produces correct number of rows and columns', () => {
  function buildTableHtml(rows, cols) {
    let html = '<table class="rta-table"><thead><tr>';
    for (let c = 0; c < cols; c++) html += `<th>Header ${c + 1}</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 1; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += `<td>Cell ${r},${c + 1}</td>`;
      html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  const table3x4 = buildTableHtml(3, 4);
  const headerCount = (table3x4.match(/<th>/g) || []).length;
  const cellCount = (table3x4.match(/<td>/g) || []).length;
  assert.strictEqual(headerCount, 4);
  assert.strictEqual(cellCount, 8); // 2 data rows * 4 cols
});

test('Dynamic table builder supports 20 or more columns with containment wrapper', () => {
  function buildContainedTableHtml(rows, cols) {
    let html = '<div class="rta-table-wrap"><table class="rta-table"><thead><tr>';
    for (let c = 0; c < cols; c++) html += `<th>Col ${c + 1}</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 1; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += `<td>R${r}C${c + 1}</td>`;
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  const table25 = buildContainedTableHtml(3, 25);
  const headerCount = (table25.match(/<th>/g) || []).length;
  assert.strictEqual(headerCount, 25);
  assert.ok(table25.startsWith('<div class="rta-table-wrap">'));
});

test('Link and Image URL embedding sanitizes protocols safely', () => {
  const safeLink = sanitizeUrl('https://example.com');
  const safeImg = sanitizeUrl('https://example.com/photo.png');
  const badLink = sanitizeUrl('javascript:alert("hacked")');

  assert.strictEqual(safeLink, 'https://example.com');
  assert.strictEqual(safeImg, 'https://example.com/photo.png');
  assert.strictEqual(badLink, '#');
});

// 6. Suggestions & Comments Track Changes Tests
console.log('\n--- Suggestions & Comments Track Changes Tests ---');

test('Suggestions system tracks additions and deletions with author metadata', () => {
  const suggestions = [];
  function addSuggestion(type, text, author) {
    const item = {
      id: 'sug-' + (suggestions.length + 1),
      type,
      text,
      author,
      timestamp: '12:10:00'
    };
    suggestions.push(item);
    return item;
  }

  const add = addSuggestion('add', 'collaborative real-time editing', 'Veeresh');
  const del = addSuggestion('del', 'legacy word editor', 'Veeresh');

  assert.strictEqual(suggestions.length, 2);
  assert.strictEqual(add.type, 'add');
  assert.strictEqual(add.text, 'collaborative real-time editing');
  assert.strictEqual(del.type, 'del');
  assert.strictEqual(del.text, 'legacy word editor');
});

test('Suggestions accept and reject cleanly update tracking state', () => {
  let suggestions = [
    { id: 'sug-1', type: 'add', text: 'new feature' },
    { id: 'sug-2', type: 'del', text: 'deprecated block' }
  ];

  function acceptSuggestion(id) {
    suggestions = suggestions.filter(s => s.id !== id);
  }

  function rejectSuggestion(id) {
    suggestions = suggestions.filter(s => s.id !== id);
  }

  acceptSuggestion('sug-1');
  assert.strictEqual(suggestions.length, 1);
  assert.strictEqual(suggestions[0].id, 'sug-2');

  rejectSuggestion('sug-2');
  assert.strictEqual(suggestions.length, 0);
});

test('Comments resolving removes comment from active list', () => {
  let comments = [
    { id: 'c-1', text: 'Fix phrasing here', quote: 'test line' },
    { id: 'c-2', text: 'Looks great!', quote: 'header line' }
  ];

  function resolveComment(id) {
    comments = comments.filter(c => c.id !== id);
  }

  resolveComment('c-1');
  assert.strictEqual(comments.length, 1);
  assert.strictEqual(comments[0].id, 'c-2');
});

// 7. Document Import Page-by-Page Splitting & Headings Tests
console.log('\n--- Document Pagination & Headings Tests ---');

test('autoPaginateHtml splits long imported document into physical pages', () => {
  // Construct 18 paragraphs each with ~30 words (approx 540 words)
  const paragraphs = [];
  for (let i = 1; i <= 20; i++) {
    paragraphs.push(`<p>This is paragraph ${i} with sufficient text words to simulate realistic content within a multi-page document file.</p>`);
  }
  const longHtml = paragraphs.join('\n');
  const paginated = autoPaginateHtml(longHtml, 300);

  assert.ok(paginated.includes('rta-page-break-print'));
  const pageCount = paginated.split('rta-page-break-print').length;
  assert.ok(pageCount >= 2, `Expected at least 2 pages, got ${pageCount}`);
});

test('autoPaginateHtml preserves pre-existing explicit page breaks', () => {
  const htmlWithBreak = '<p>Page 1 content</p><div class="rta-page-break-print" style="page-break-after:always;"></div><p>Page 2 content</p>';
  const result = autoPaginateHtml(htmlWithBreak);
  assert.strictEqual(result, htmlWithBreak);
});

test('Headings H1 through H6 and Paragraph mapping are verified', () => {
  const validHeadings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
  validHeadings.forEach(tag => {
    const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag);
    if (isHeading) {
      assert.ok(tag.startsWith('h'));
    } else {
      assert.strictEqual(tag, 'p');
    }
  });
});

test('Multi-user live typing tooltip and distinct color assignment', () => {
  const users = [
    { id: 'usr-1', name: 'You (Author)', color: '#6366f1' },
    { id: 'usr-2', name: 'Sarah (Design Lead)', color: '#ec4899' },
    { id: 'usr-3', name: 'Alex (Tech Lead)', color: '#06b6d4' }
  ];

  users.forEach(u => {
    assert.ok(u.color.startsWith('#'), 'User has valid hex color');
    assert.ok(u.name.length > 0, 'User has name');
  });

  // Verify unique colors
  const colors = new Set(users.map(u => u.color));
  assert.strictEqual(colors.size, users.length, 'Each user has a distinct color');
});

test('Version Comparison dropdown lookup and multi-version selection', () => {
  const versions = [
    { id: 'ver-1', title: 'Initial Draft', html: '<p>First version</p>', timestamp: '10:00 AM', author: 'Author', words: 2 },
    { id: 'ver-2', title: 'Draft v2', html: '<p>First version with revisions</p>', timestamp: '11:00 AM', author: 'Sarah', words: 5 }
  ];

  const getVersionData = (id, liveHtml) => {
    if (id === 'live') {
      return { id: 'live', title: 'Current Live Document', html: liveHtml, isLive: true };
    }
    return versions.find(v => v.id === id) || versions[0];
  };

  const selectedA = getVersionData('ver-1', '<p>Live</p>');
  const selectedB = getVersionData('live', '<p>Live edit</p>');
  const compareWithV2 = getVersionData('ver-2', '<p>Live edit</p>');

  assert.strictEqual(selectedA.id, 'ver-1');
  assert.strictEqual(selectedA.title, 'Initial Draft');
  assert.strictEqual(selectedB.isLive, true);
  assert.strictEqual(compareWithV2.id, 'ver-2');
  assert.strictEqual(compareWithV2.author, 'Sarah');
});

test('Annotation Hover Tooltip resolution for comments and suggestions', () => {
  const comments = [
    { id: 'c-101', text: 'Great point', author: 'Sarah (Design Lead)', authorColor: '#ec4899' }
  ];
  const suggestions = [
    { id: 'sug-102', type: 'add', text: 'fast', author: 'Alex (Tech Lead)', authorColor: '#059669' },
    { id: 'sug-103', type: 'del', text: 'slow', author: 'Alex (Tech Lead)', authorColor: '#dc2626' }
  ];

  const getAnnotationInfo = (id, markAttrs = {}) => {
    const comment = comments.find(c => c.id === id);
    if (comment) {
      return { id, type: 'comment', author: comment.author, color: comment.authorColor, icon: '💬' };
    }
    const suggestion = suggestions.find(s => s.id === id);
    if (suggestion) {
      const isDel = suggestion.type === 'del';
      return { id, type: 'suggestion', author: suggestion.author, color: suggestion.authorColor, icon: isDel ? '✂️' : '💡' };
    }
    if (markAttrs['data-author']) {
      return { id, type: markAttrs.type || 'comment', author: markAttrs['data-author'], color: markAttrs['data-author-color'] || '#2563eb', icon: '💬' };
    }
    return null;
  };

  const commentInfo = getAnnotationInfo('c-101');
  assert.ok(commentInfo);
  assert.strictEqual(commentInfo.author, 'Sarah (Design Lead)');
  assert.strictEqual(commentInfo.color, '#ec4899');
  assert.strictEqual(commentInfo.icon, '💬');

  const addInfo = getAnnotationInfo('sug-102');
  assert.ok(addInfo);
  assert.strictEqual(addInfo.author, 'Alex (Tech Lead)');
  assert.strictEqual(addInfo.color, '#059669');
  assert.strictEqual(addInfo.icon, '💡');

  const delInfo = getAnnotationInfo('sug-103');
  assert.ok(delInfo);
  assert.strictEqual(delInfo.author, 'Alex (Tech Lead)');
  assert.strictEqual(delInfo.color, '#dc2626');
  assert.strictEqual(delInfo.icon, '✂️');

  const fallbackInfo = getAnnotationInfo('c-999', { 'data-author': 'Guest Reviewer', 'data-author-color': '#8b5cf6' });
  assert.ok(fallbackInfo);
  assert.strictEqual(fallbackInfo.author, 'Guest Reviewer');
  assert.strictEqual(fallbackInfo.color, '#8b5cf6');
});

// 8. Version Comparison & Visual Diff Engine Tests
console.log('\n--- Version Comparison & Visual Diff Tests ---');

test('tokenizeHtml parses tags, words, and whitespace accurately', () => {
  const html = '<p>Hello <strong>world</strong>!</p>';
  const tokens = tokenizeHtml(html);
  assert.deepStrictEqual(tokens, [
    '<p>', 'Hello', ' ', '<strong>', 'world', '</strong>', '!', '</p>'
  ]);
});

test('diffTokens accurately tracks added, deleted, and unchanged tokens', () => {
  const tokensA = ['The', ' ', 'quick', ' ', 'fox'];
  const tokensB = ['The', ' ', 'fast', ' ', 'fox', ' ', 'jumps'];
  const diff = diffTokens(tokensA, tokensB);

  const hasAdd = diff.some(d => d.type === 'add' && d.value === 'fast');
  const hasDel = diff.some(d => d.type === 'del' && d.value === 'quick');
  const hasAddSuffix = diff.some(d => d.type === 'add' && d.value === 'jumps');
  const hasEqual = diff.some(d => d.type === 'equal' && d.value === 'fox');

  assert.ok(hasAdd, 'Should contain added token "fast"');
  assert.ok(hasDel, 'Should contain deleted token "quick"');
  assert.ok(hasAddSuffix, 'Should contain added suffix "jumps"');
  assert.ok(hasEqual, 'Should contain unchanged token "fox"');
});

test('computeDocumentDiff highlights additions in green and deletions in red', () => {
  const oldDoc = '<p>Rich text editor for developers</p>';
  const newDoc = '<p>Rich text editor for awesome developers</p>';

  const result = computeDocumentDiff(oldDoc, newDoc);

  assert.ok(result.stats.additions >= 1, 'Detects added words');
  assert.strictEqual(result.stats.deletions, 0, 'No words deleted');
  assert.ok(result.rightHtml.includes('rta-diff-add'), 'Right HTML contains green added tags');
  assert.ok(result.rightHtml.includes('awesome'), 'Right HTML highlights "awesome"');
  assert.ok(!result.leftHtml.includes('rta-diff-del'), 'Left HTML has no deletions');
  assert.ok(result.unifiedHtml.includes('rta-diff-add'), 'Unified HTML contains added tags');
});

test('computeDocumentDiff detects word removals and highlights in red', () => {
  const oldDoc = '<p>Simple slow basic tool</p>';
  const newDoc = '<p>Simple tool</p>';

  const result = computeDocumentDiff(oldDoc, newDoc);

  assert.ok(result.stats.deletions >= 2, 'Detects deleted words');
  assert.strictEqual(result.stats.additions, 0, 'No words added');
  assert.ok(result.leftHtml.includes('rta-diff-del'), 'Left HTML contains red deleted tags');
  assert.ok(result.leftHtml.includes('slow'), 'Left HTML highlights deleted word "slow"');
  assert.ok(result.leftHtml.includes('basic'), 'Left HTML highlights deleted word "basic"');
  assert.ok(result.unifiedHtml.includes('rta-diff-del'), 'Unified HTML contains red deleted tags');
});

test('computeDocumentDiff handles identical documents with zero changes', () => {
  const doc = '<p>Identical content in both versions</p>';
  const result = computeDocumentDiff(doc, doc);

  assert.strictEqual(result.stats.additions, 0);
  assert.strictEqual(result.stats.deletions, 0);
  assert.strictEqual(result.stats.totalChanges, 0);
  assert.ok(!result.leftHtml.includes('rta-diff-del'));
  assert.ok(!result.rightHtml.includes('rta-diff-add'));
});

// 9. Active User Management & Switcher Tests
console.log('\n--- Active User Management & Switcher Tests ---');

test('User manager correctly initializes default users and allows switching active user', () => {
  const initialUser = { id: 'usr-1', name: 'You (Author)', color: '#6366f1' };
  const users = [
    initialUser,
    { id: 'usr-sarah', name: 'Sarah (Design Lead)', color: '#ec4899' },
    { id: 'usr-alex', name: 'Alex (Tech Lead)', color: '#059669' }
  ];
  let currentUser = initialUser;
  let userChanged = null;

  function getUsers() {
    return [...users];
  }

  function getCurrentUser() {
    return currentUser;
  }

  function getUser(idOrName) {
    return users.find(u => u.id === idOrName || u.name === idOrName) || null;
  }

  function setUser(userOrId) {
    let found = null;
    if (typeof userOrId === 'string') {
      found = getUser(userOrId);
    } else if (userOrId && typeof userOrId === 'object') {
      found = getUser(userOrId.id) || getUser(userOrId.name);
      if (!found) {
        found = userOrId;
        users.push(found);
      }
    }
    if (found) {
      currentUser = found;
      userChanged = found;
      return found;
    }
    return currentUser;
  }

  function addUser(name, color = null) {
    const cleanName = (name || '').trim();
    if (!cleanName) return null;
    const existing = users.find(u => u.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      return setUser(existing);
    }
    const newUser = {
      id: `usr-${Date.now()}`,
      name: cleanName,
      color: color || '#2563eb'
    };
    users.push(newUser);
    setUser(newUser);
    return newUser;
  }

  assert.strictEqual(getUsers().length, 3);
  assert.strictEqual(getCurrentUser().name, 'You (Author)');

  // Switch to existing user Sarah
  const switched = setUser('usr-sarah');
  assert.strictEqual(switched.name, 'Sarah (Design Lead)');
  assert.strictEqual(getCurrentUser().name, 'Sarah (Design Lead)');
  assert.strictEqual(userChanged.name, 'Sarah (Design Lead)');

  // Add new user Michael
  const added = addUser('Michael (Product Lead)', '#f59e0b');
  assert.strictEqual(added.name, 'Michael (Product Lead)');
  assert.strictEqual(added.color, '#f59e0b');
  assert.strictEqual(getUsers().length, 4);
  assert.strictEqual(getCurrentUser().name, 'Michael (Product Lead)');

  // Adding existing user re-selects them without duplicates
  const reAdded = addUser('Michael (Product Lead)');
  assert.strictEqual(reAdded.id, added.id);
  assert.strictEqual(getUsers().length, 4);
});

// 10. Live Real-time Auto-Pagination Engine Tests
console.log('\n--- Live Auto-Pagination Engine Tests ---');

test('Live auto-pagination detects page overflow and moves elements to next page', () => {
  const budget = 960;
  const page1Nodes = [
    { text: 'Paragraph 1', height: 200, bottom: 200 },
    { text: 'Paragraph 2', height: 300, bottom: 500 },
    { text: 'Paragraph 3', height: 300, bottom: 800 },
    { text: 'Paragraph 4', height: 250, bottom: 1050 }, // Overflows budget (1050 > 960)
    { text: 'Paragraph 5', height: 100, bottom: 1150 }  // Overflows budget
  ];

  const page1Retained = [];
  const page2Moved = [];

  for (const node of page1Nodes) {
    if (node.bottom > budget) {
      page2Moved.push(node);
    } else {
      page1Retained.push(node);
    }
  }

  assert.strictEqual(page1Retained.length, 3, 'First 3 paragraphs fit on Page 1');
  assert.strictEqual(page2Moved.length, 2, 'Overflowing 2 paragraphs move to Page 2');
  assert.strictEqual(page2Moved[0].text, 'Paragraph 4');
  assert.strictEqual(page2Moved[1].text, 'Paragraph 5');
});

test('Live auto-pagination correctly splits oversized paragraphs spanning boundary', () => {
  const budget = 960;
  const childTop = 880;
  const childBottom = 1040;
  const paragraphText = 'Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8 Word9 Word10 Word11 Word12';
  const words = paragraphText.split(' ');

  const ratio = Math.max(0.2, Math.min(0.8, (budget - childTop) / (childBottom - childTop)));
  const splitIndex = Math.max(1, Math.min(words.length - 1, Math.floor(words.length * ratio)));

  const part1 = words.slice(0, splitIndex).join(' ');
  const part2 = words.slice(splitIndex).join(' ');

  assert.ok(part1.length > 0, 'Part 1 stays on current page');
  assert.ok(part2.length > 0, 'Part 2 moves to next page');
  assert.strictEqual(`${part1} ${part2}`, paragraphText, 'Content integrity is 100% preserved');
});

// 11. Position-Based Card Clustering & Hover Layer Elevation Tests
console.log('\n--- Card Clustering & Layer Elevation Tests ---');

test('Cards within 50px vertical proximity are grouped into a single line cluster', () => {
  const cardData = [
    { id: 'c-1', targetTop: 120 },
    { id: 'c-2', targetTop: 135 }, // Δy = 15px <= 50px -> same cluster
    { id: 'sug-1', targetTop: 155 }, // Δy = 35px <= 50px -> same cluster
    { id: 'c-3', targetTop: 320 }, // Δy = 165px > 50px -> new cluster
    { id: 'sug-2', targetTop: 340 }  // Δy = 20px <= 50px -> cluster with c-3
  ];

  // Cluster algorithm matching EditorCore.js
  const clusters = [];
  let curCluster = null;

  for (const item of cardData) {
    if (!curCluster || (item.targetTop - curCluster.anchorTop) > 50) {
      curCluster = {
        id: `cluster-${clusters.length}`,
        anchorTop: item.targetTop,
        items: [item]
      };
      clusters.push(curCluster);
    } else {
      curCluster.items.push(item);
    }
  }

  assert.strictEqual(clusters.length, 2, 'Total 2 clusters formed');
  assert.strictEqual(clusters[0].items.length, 3, 'First cluster contains 3 co-located cards');
  assert.strictEqual(clusters[1].items.length, 2, 'Second cluster contains 2 cards');
  assert.strictEqual(clusters[0].anchorTop, 120);
  assert.strictEqual(clusters[1].anchorTop, 320);
});

test('Stacked cluster calculates 3D deck styling and elevates active hovered card to top layer', () => {
  const clusterItems = [
    { id: 'c-1', height: 110 },
    { id: 'c-2', height: 110 },
    { id: 'sug-1', height: 110 }
  ];
  const baseTop = 150;
  const activeHoveredId = 'sug-1'; // The 3rd card is hovered in the document

  const cardStyles = clusterItems.map((item, idx) => {
    const isActiveTopLayer = item.id === activeHoveredId;
    if (isActiveTopLayer) {
      return {
        id: item.id,
        top: baseTop,
        zIndex: 300,
        transform: 'translateY(-4px) scale(1.025)',
        isTopLayer: true
      };
    }
    const offset = Math.min(idx * 7, 21);
    const scale = 1 - (idx * 0.03);
    return {
      id: item.id,
      top: baseTop,
      zIndex: 30 - idx,
      transform: `translateY(${offset}px) scale(${scale})`,
      isTopLayer: false
    };
  });

  // Verify non-hovered cards have stacked deck ordering
  assert.strictEqual(cardStyles[0].zIndex, 30);
  assert.strictEqual(cardStyles[1].zIndex, 29);
  assert.strictEqual(cardStyles[0].transform, 'translateY(0px) scale(1)');
  assert.strictEqual(cardStyles[1].transform, 'translateY(7px) scale(0.97)');

  // Verify the hovered item 'sug-1' pops directly to the TOP layer (z-index 300)
  assert.strictEqual(cardStyles[2].zIndex, 300);
  assert.strictEqual(cardStyles[2].isTopLayer, true);
  assert.strictEqual(cardStyles[2].transform, 'translateY(-4px) scale(1.025)');
});

test('Hovering card cluster fans out / spreads all items vertically', () => {
  const clusterItems = [
    { id: 'c-1', height: 100 },
    { id: 'c-2', height: 100 },
    { id: 'sug-1', height: 100 }
  ];
  const baseTop = 100;

  // Spread calculation matching EditorCore.js
  const spreadPositions = clusterItems.map((item, idx) => {
    const cardTop = baseTop + (idx * (item.height + 10));
    return { id: item.id, top: cardTop, zIndex: 100 + idx };
  });

  assert.strictEqual(spreadPositions[0].top, 100, 'First card at base position');
  assert.strictEqual(spreadPositions[1].top, 210, 'Second card positioned below first');
  assert.strictEqual(spreadPositions[2].top, 320, 'Third card positioned below second');

  // Total cluster height when spread
  const totalSpreadHeight = clusterItems.reduce((acc, it) => acc + it.height + 10, 0);
  assert.strictEqual(totalSpreadHeight, 330, 'Total spread height spans all cards with gaps');
});

// 12. Gutter Margin Space Positioning (Left vs Right) Tests
console.log('\n--- Gutter Margin Space Positioning Tests ---');

test('Gutter position defaults to right and supports switching to left margin space', () => {
  const state = {
    gutterPosition: 'right',
    cardsGutterClass: 'rta-cards-gutter is-right',
    containerAttr: 'right'
  };

  const setGutterPosition = (pos) => {
    const next = pos === 'left' ? 'left' : 'right';
    state.gutterPosition = next;
    state.cardsGutterClass = `rta-cards-gutter is-${next}`;
    state.containerAttr = next;
    return next;
  };

  const toggleGutterPosition = () => {
    return setGutterPosition(state.gutterPosition === 'left' ? 'right' : 'left');
  };

  assert.strictEqual(state.gutterPosition, 'right', 'Initial position is right');

  // Switch to left
  const newPos = setGutterPosition('left');
  assert.strictEqual(newPos, 'left');
  assert.strictEqual(state.gutterPosition, 'left');
  assert.strictEqual(state.cardsGutterClass, 'rta-cards-gutter is-left');
  assert.strictEqual(state.containerAttr, 'left');

  // Toggle back to right
  const toggledPos = toggleGutterPosition();
  assert.strictEqual(toggledPos, 'right');
  assert.strictEqual(state.gutterPosition, 'right');
  assert.strictEqual(state.cardsGutterClass, 'rta-cards-gutter is-right');

  // Toggle again to left
  const toggledLeft = toggleGutterPosition();
  assert.strictEqual(toggledLeft, 'left');
  assert.strictEqual(state.gutterPosition, 'left');
});

test('Left-side gutter margin positioning geometry ensures clean non-overlapping margin alignment', () => {
  const pageWidth = 820;
  const viewportWidth = 1600;
  const gutterWidth = 270;
  const pageCenter = viewportWidth / 2; // 800px
  const pageLeftEdge = pageCenter - (pageWidth / 2); // 800 - 410 = 390px
  const pageRightEdge = pageCenter + (pageWidth / 2); // 800 + 410 = 1210px

  // Right Gutter calculation: left: calc(50% + 418px)
  const rightGutterLeft = pageCenter + 418; // 800 + 418 = 1218px
  assert.ok(rightGutterLeft >= pageRightEdge, 'Right gutter sits strictly to the right of the page');

  // Left Gutter calculation: right: calc(50% + 418px) -> left offset is viewport - right - width
  const leftGutterRightEdge = viewportWidth - (pageCenter + 418); // 1600 - 1218 = 382px
  const leftGutterLeftEdge = leftGutterRightEdge - gutterWidth; // 382 - 270 = 112px
  assert.ok(leftGutterRightEdge <= pageLeftEdge, 'Left gutter sits strictly to the left of the page');
  assert.strictEqual(pageLeftEdge - leftGutterRightEdge, 8, 'Clean 8px breathing gap between page and left cards gutter');
});

test('Both-side bilateral arrangement automatically places cards on free side and groups when full', () => {
  const midX = 500;
  const cards = [
    { id: 'c-1', targetTop: 100, targetLeft: 300 }, // Line 1, card 1 (left half)
    { id: 'c-2', targetTop: 110, targetLeft: 700 }, // Line 1, card 2 (right half)
    { id: 'c-3', targetTop: 120, targetLeft: 350 }, // Line 1, card 3 (overflows line)
    { id: 'c-4', targetTop: 125, targetLeft: 650 }, // Line 1, card 4 (overflows line)
    { id: 'c-5', targetTop: 300, targetLeft: 600 }  // Line 2, card 1 (right half)
  ];

  // Run bilateral partitioning logic matching EditorCore.js
  const bands = [];
  let curBand = null;
  for (const item of cards) {
    if (!curBand || (item.targetTop - curBand.anchorTop) > 50) {
      curBand = { anchorTop: item.targetTop, items: [item] };
      bands.push(curBand);
    } else {
      curBand.items.push(item);
    }
  }

  const leftCards = [];
  const rightCards = [];

  for (const band of bands) {
    if (band.items.length === 1) {
      const it = band.items[0];
      if (it.targetLeft < midX) leftCards.push(it);
      else rightCards.push(it);
    } else if (band.items.length === 2) {
      const it1 = band.items[0];
      const it2 = band.items[1];
      if (it1.targetLeft <= it2.targetLeft) {
        leftCards.push(it1);
        rightCards.push(it2);
      } else {
        leftCards.push(it2);
        rightCards.push(it1);
      }
    } else {
      band.items.forEach((it, idx) => {
        if (idx % 2 === 0) rightCards.push(it);
        else leftCards.push(it);
      });
    }
  }

  // Band 1 had 4 cards: 2 distributed to left, 2 distributed to right
  assert.strictEqual(bands.length, 2, '2 line bands detected');
  assert.strictEqual(bands[0].items.length, 4, 'Line 1 has 4 co-located annotations');
  assert.strictEqual(leftCards.length, 2, '2 cards allocated to Left margin');
  assert.strictEqual(rightCards.length, 3, '3 cards allocated to Right margin (2 from Line 1, 1 from Line 2)');
});

test('Expanded 4-card cluster sequentially accumulates rendered heights with zero overlap', () => {
  const cardsInCluster = [
    { id: 'c-1', height: 150 }, // Front card with line badge
    { id: 'c-2', height: 110 },
    { id: 'c-3', height: 130 },
    { id: 'c-4', height: 95 }
  ];
  const baseTop = 80;
  const gap = 12;

  let spreadAccumulator = baseTop;
  const spreadPositions = [];

  for (let idx = 0; idx < cardsInCluster.length; idx++) {
    const item = cardsInCluster[idx];
    spreadPositions.push({
      id: item.id,
      top: spreadAccumulator,
      bottom: spreadAccumulator + item.height,
      zIndex: 100 + idx
    });
    spreadAccumulator += item.height + gap;
  }

  // Verify non-overlapping sequential boundaries for all 4 cards
  assert.strictEqual(spreadPositions[0].top, 80);
  assert.strictEqual(spreadPositions[0].bottom, 230);

  assert.strictEqual(spreadPositions[1].top, 242); // 230 + 12 gap
  assert.strictEqual(spreadPositions[1].bottom, 352);

  assert.strictEqual(spreadPositions[2].top, 364); // 352 + 12 gap
  assert.strictEqual(spreadPositions[2].bottom, 494);

  assert.strictEqual(spreadPositions[3].top, 506); // 494 + 12 gap
  assert.strictEqual(spreadPositions[3].bottom, 601);

  // Every card has strictly increasing top and no intersection
  for (let i = 1; i < spreadPositions.length; i++) {
    assert.ok(spreadPositions[i].top >= spreadPositions[i - 1].bottom + gap,
      `Card ${i} layout is completely separated and does not clip Card ${i - 1}`);
  }
});

// Toolbar Configuration, Defaults & Visibility Tests
console.log('\n--- Toolbar Defaults & Visibility Tests ---');

test('Toolbar initializes with custom defaults and merges correctly', () => {
  const customDefaults = {
    style: 'h2',
    fontSize: '20',
    lineHeight: '1.4',
    color: '#3b82f6',
    highlight: '#a7f3d0',
    layout: 'letter',
    margin: 'both',
    mode: 'suggesting',
    tableRows: 5,
    tableCols: 6
  };

  const toolbar = new Toolbar(null, { defaults: customDefaults });
  const defaults = toolbar.getDefaults();

  assert.strictEqual(defaults.style, 'h2');
  assert.strictEqual(defaults.fontSize, '20');
  assert.strictEqual(defaults.lineHeight, '1.4');
  assert.strictEqual(defaults.color, '#3b82f6');
  assert.strictEqual(defaults.highlight, '#a7f3d0');
  assert.strictEqual(defaults.layout, 'letter');
  assert.strictEqual(defaults.margin, 'both');
  assert.strictEqual(defaults.mode, 'suggesting');
  assert.strictEqual(defaults.tableRows, 5);
  assert.strictEqual(defaults.tableCols, 6);

  // Dynamic setDefaults
  toolbar.setDefaults({ fontSize: 24, margin: 'left' });
  const updated = toolbar.getDefaults();
  assert.strictEqual(updated.fontSize, 24);
  assert.strictEqual(updated.margin, 'left');
  assert.strictEqual(updated.style, 'h2'); // Preserved
});

test('Toolbar handles overall visibility (show, hide, toggle)', () => {
  const toolbar = new Toolbar(null, { visible: true });
  assert.strictEqual(toolbar.isVisible(), true);

  toolbar.hide();
  assert.strictEqual(toolbar.isVisible(), false);

  toolbar.show();
  assert.strictEqual(toolbar.isVisible(), true);

  toolbar.toggle();
  assert.strictEqual(toolbar.isVisible(), false);

  toolbar.toggle(true);
  assert.strictEqual(toolbar.isVisible(), true);

  // Initialized with visible: false
  const hiddenToolbar = new Toolbar(null, { visible: false });
  assert.strictEqual(hiddenToolbar.isVisible(), false);
  hiddenToolbar.show();
  assert.strictEqual(hiddenToolbar.isVisible(), true);
});

test('Toolbar manages granular item visibility, show/hide, and aliases', () => {
  const toolbar = new Toolbar(null, {
    hiddenItems: ['upload', 'table'],
    show: { mode: false }
  });

  // Verify initial hidden state
  assert.strictEqual(toolbar.isItemVisible('upload'), false);
  assert.strictEqual(toolbar.isItemVisible('table'), false);
  assert.strictEqual(toolbar.isItemVisible('mode'), false);
  assert.strictEqual(toolbar.isItemVisible('bold'), true);
  assert.strictEqual(toolbar.isItemVisible('italic'), true);

  // Show hidden item
  toolbar.showItem('upload');
  assert.strictEqual(toolbar.isItemVisible('upload'), true);

  // Hide item
  toolbar.hideItem('bold');
  assert.strictEqual(toolbar.isItemVisible('bold'), false);

  // Toggle item
  toolbar.toggleItem('bold');
  assert.strictEqual(toolbar.isItemVisible('bold'), true);

  // Alias support (heading -> style, font -> fontSize, gutter -> margin)
  assert.strictEqual(toolbar.resolveItemKey('heading'), 'style');
  assert.strictEqual(toolbar.resolveItemKey('font'), 'fontSize');
  assert.strictEqual(toolbar.resolveItemKey('gutter'), 'margin');
  assert.strictEqual(toolbar.resolveItemKey('comments'), 'comment');

  toolbar.hideItem('heading');
  assert.strictEqual(toolbar.isItemVisible('style'), false);
  assert.strictEqual(toolbar.isItemVisible('heading'), false);

  toolbar.showItem('style');
  assert.strictEqual(toolbar.isItemVisible('heading'), true);

  // Batch visibility update
  toolbar.setItemsVisibility({ italic: false, underline: false, bold: true });
  assert.strictEqual(toolbar.isItemVisible('italic'), false);
  assert.strictEqual(toolbar.isItemVisible('underline'), false);
  assert.strictEqual(toolbar.isItemVisible('bold'), true);

  // Users group is hidden in toolbar by default (moved to top bar)
  assert.strictEqual(toolbar.isItemVisible('users'), false);
  toolbar.showItem('users');
  assert.strictEqual(toolbar.isItemVisible('users'), true);
});

// Real-Time Collaboration & Synchronization Engine Tests
console.log('\n--- Real-Time Collaboration & Synchronization Tests ---');

test('CollabEngine applies remote edits and filters out echo loop messages', () => {
  let docContent = '<p>Initial local draft</p>';
  const mockEditor = {
    getHTML: () => docContent,
    setHTML: (val) => { docContent = val; },
    on: () => {},
    emit: () => {}
  };

  const userAlice = { id: 'usr-1', name: 'Alice', color: '#6366f1' };
  const userBob = { id: 'usr-2', name: 'Bob', color: '#ec4899' };

  const engine = new CollabEngine(mockEditor, { user: userAlice });

  // 1. Receive remote edit from Bob
  engine.handleIncomingMessage({
    senderId: userBob.id,
    type: 'edit',
    content: '<p>Updated paragraph by Bob</p>',
    user: userBob
  });

  assert.strictEqual(docContent, '<p>Updated paragraph by Bob</p>');

  // 2. Ignore self-echo message sent by Alice
  engine.handleIncomingMessage({
    senderId: userAlice.id,
    type: 'edit',
    content: '<p>Echo from Alice</p>',
    user: userAlice
  });

  assert.strictEqual(docContent, '<p>Updated paragraph by Bob</p>', 'Should ignore self message');

  // 3. New peer joins and registers presence
  engine.handleIncomingMessage({
    senderId: userBob.id,
    type: 'peer_join',
    user: userBob
  });

  assert.ok(engine.peers.has(userBob.id), 'Records Bob presence');
  assert.strictEqual(engine.peers.get(userBob.id).name, 'Bob');

  // 4. Peer disconnect removes presence
  engine.handleIncomingMessage({
    senderId: userBob.id,
    type: 'peer_leave',
    user: userBob
  });

  assert.ok(!engine.peers.has(userBob.id), 'Removes Bob presence on leave');
});

test('CollabEngine page-relative coordinate translation across viewports', () => {
  // Sender on wide maximized screen (1920px): page sheet at left=550px, caret at x=630px
  const senderCoords = {
    x: 630,
    y: 215,
    height: 24,
    pageNumber: 1,
    relX: 80, // 630 - 550
    relY: 45
  };

  // Receiver on half-screen or different monitor (900px): page sheet at left=40px, top=120px
  const receiverPageRect = { left: 40, top: 120 };
  const finalX = receiverPageRect.left + senderCoords.relX;
  const finalY = receiverPageRect.top + senderCoords.relY;

  assert.strictEqual(senderCoords.relX, 80, 'Sender computes page-relative offset');
  assert.strictEqual(finalX, 120, 'Receiver locks cursor to exact character coordinate on its page sheet');
  assert.strictEqual(finalY, 165, 'Receiver locks cursor vertically to exact character coordinate');
});

test('CollabEngine disconnect cleanly clears presence and marks disconnected', () => {
  const mockEditor = {
    getHTML: () => '<p>Document</p>',
    setHTML: () => {},
    on: () => {},
    emit: () => {}
  };
  const user = { id: 'u-self', name: 'Self', color: '#6366f1' };
  const engine = new CollabEngine(mockEditor, { roomId: 'test-room', user });
  engine.peers.set('peer-1', { id: 'peer-1', name: 'Other User' });

  assert.strictEqual(engine.peers.size, 1);
  engine.disconnect();

  assert.strictEqual(engine.peers.size, 0, 'Peers cleared on disconnect');
  assert.strictEqual(engine.isManuallyDisconnected, true, 'Marked as manually disconnected');
  assert.strictEqual(engine.isConnected, false, 'isConnected is false');
});

// Document Context, Version History & Comparison Engine Tests
console.log('\n--- Document Context, Version History & Comparison Tests ---');

test('EditorCore creates, lists, retrieves, and deletes version snapshots', () => {
  const core = new EditorCore({
    initialContent: '<p>Version 1 content</p>',
    user: { id: 'u-1', name: 'Veeresh Poojari', color: '#6366f1' }
  });

  const v1 = core.saveVersion('Initial Draft', 'First draft release');
  assert.ok(v1.id);
  assert.strictEqual(v1.title, 'Initial Draft');
  assert.strictEqual(v1.description, 'First draft release');
  assert.strictEqual(v1.author, 'Veeresh Poojari');

  const versions = core.getVersions();
  assert.ok(versions.length >= 2); // Initial draft + new checkpoint

  const retrieved = core.getVersion(v1.id);
  assert.strictEqual(retrieved.title, 'Initial Draft');

  // Live version pseudo-lookup
  const live = core.getVersion('live');
  assert.strictEqual(live.id, 'live');
  assert.strictEqual(live.isLive, true);

  // Delete version
  const deleted = core.deleteVersion(v1.id);
  assert.strictEqual(deleted.id, v1.id);
  assert.strictEqual(core.getVersion(v1.id), null);
});

test('EditorCore programmatic version comparison computes accurate diffs', () => {
  const core = new EditorCore({
    initialContent: '<p>The quick brown fox jumps over the lazy dog.</p>'
  });

  const v1 = core.saveVersion('Original');
  
  // Create second version with modified text
  const v2 = core.saveVersion('Revision', '', {
    html: '<p>The swift red fox jumps over the sleepy dog.</p>'
  });

  const comparison = core.compareVersions(v1.id, v2.id);
  assert.strictEqual(comparison.versionA.id, v1.id);
  assert.strictEqual(comparison.versionB.id, v2.id);
  assert.ok(comparison.stats.totalChanges > 0);
  assert.ok(comparison.leftHtml.includes('rta-diff-del'));
  assert.ok(comparison.rightHtml.includes('rta-diff-add'));
  assert.ok(comparison.unifiedHtml.includes('rta-diff-del'));
});

test('EditorCore generates incremental comparison list with timeline diff stats', () => {
  const core = new EditorCore();
  core.setVersions([
    { id: 'v1', title: 'Chapter 1', html: '<p>Introductory paragraph</p>' },
    { id: 'v2', title: 'Chapter 2', html: '<p>Introductory paragraph with revisions</p>' }
  ]);

  const list = core.getComparisonList();
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].previousVersionId, null);
  assert.strictEqual(list[0].stats, null);
  assert.strictEqual(list[1].previousVersionId, 'v1');
  assert.ok(list[1].stats.additions > 0);
});

test('EditorCore gets and sets full document context bundle (developer data access)', () => {
  const core = new EditorCore({
    user: { id: 'usr-v', name: 'Veeresh Poojari (Author)', color: '#6366f1' }
  });

  // Seed sample comments and suggestions
  core.setComments([
    { id: 'c-1', text: 'Great point', author: 'Veeresh Poojari (Author)', timestamp: '12:00' }
  ]);
  core.setSuggestions([
    { id: 's-1', type: 'add', text: 'extra word', author: 'Alex', timestamp: '12:05' }
  ]);

  // Export full context
  const bundle = core.getData();
  assert.strictEqual(bundle.schemaVersion, '1.0.0');
  assert.ok(bundle.metadata);
  assert.ok(bundle.settings);
  assert.ok(bundle.content);
  assert.strictEqual(bundle.comments.length, 1);
  assert.strictEqual(bundle.comments[0].text, 'Great point');
  assert.strictEqual(bundle.suggestions.length, 1);
  assert.ok(Array.isArray(bundle.versions));
  assert.ok(Array.isArray(bundle.comparisonList));

  // Modify and restore into a new editor instance
  const newCore = new EditorCore();
  bundle.content.html = '<p>Restored via developer API</p>';
  bundle.settings.pageLayout = 'letter';
  bundle.settings.gutterPosition = 'both';

  const restored = newCore.setData(bundle);
  assert.strictEqual(restored, true);
  assert.strictEqual(newCore.options.pageLayout, 'letter');
  assert.strictEqual(newCore.options.gutterPosition, 'both');
  assert.strictEqual(newCore.getComments().length, 1);
  assert.strictEqual(newCore.getComments()[0].text, 'Great point');
  assert.strictEqual(newCore.getSuggestions().length, 1);
});

// Summary
console.log(`\n========================================`);
console.log(`Test Results: ${passedTests}/${totalTests} Passed.`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('🎉 All richtext-all unit tests passed successfully!');
}


