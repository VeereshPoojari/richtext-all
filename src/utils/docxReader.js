/**
 * docxReader.js - Zero-Dependency Microsoft Word (.docx) & Document Importer
 * Parses .docx ZIP XML packages, Word HTML, Markdown, and Text files directly in the browser.
 * (c) 2026 Veeresh Poojari <veeresha3993@gmail.com>
 * MIT Licensed
 */

import { escapeHtml, sanitizeHtml } from './security.js';

/**
 * Reads any document file (docx, doc, md, html, txt) and returns editable HTML with page-by-page splitting.
 */
export async function readDocumentFile(file) {
  if (!file) throw new Error('No file provided');

  const fileName = file.name.toLowerCase();
  let rawHtml = '';

  // 1. DOCX File
  if (fileName.endsWith('.docx')) {
    rawHtml = await parseDocxFile(file);
  }
  // 2. Legacy Word .doc or HTML
  else if (fileName.endsWith('.doc') || fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    const text = await readFileAsText(file);
    if (text.includes('<body') || text.includes('<html')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      rawHtml = doc.body ? sanitizeHtml(doc.body.innerHTML) : sanitizeHtml(text);
    } else {
      rawHtml = sanitizeHtml(text);
    }
  }
  // 3. Markdown
  else if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
    const md = await readFileAsText(file);
    rawHtml = markdownToHtmlSimple(md);
  }
  // 4. Plain Text
  else {
    const rawText = await readFileAsText(file);
    rawHtml = rawText
      .split(/\r?\n\r?\n/)
      .map(p => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br>')}</p>`)
      .join('');
  }

  return autoPaginateHtml(rawHtml);
}

/**
 * Automatically splits multi-page content into physical A4 pages
 * using <div class="rta-page-break-print"> page separators.
 */
export function autoPaginateHtml(html, wordsPerPage = 420) {
  if (!html) return '<p><br></p>';
  if (html.includes('rta-page-break-print')) return html;

  // Split content by block-level HTML tags
  const blocks = html.match(/<(p|h[1-6]|table|blockquote|ul|ol|pre|div)[^>]*>[\s\S]*?<\/\1>/gi);
  if (!blocks || blocks.length <= 8) return html;

  let pages = [];
  let currentWords = 0;
  let currentPageBlocks = [];

  for (const block of blocks) {
    const plainText = block.replace(/<[^>]+>/g, ' ').trim();
    const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

    if (currentWords > 0 && (currentWords + wordCount > wordsPerPage || currentPageBlocks.length >= 14)) {
      pages.push(currentPageBlocks.join('\n'));
      currentPageBlocks = [block];
      currentWords = wordCount;
    } else {
      currentPageBlocks.push(block);
      currentWords += wordCount;
    }
  }

  if (currentPageBlocks.length > 0) {
    pages.push(currentPageBlocks.join('\n'));
  }

  if (pages.length <= 1) return html;
  return pages.join('\n<div class="rta-page-break-print" style="page-break-after:always;"></div>\n');
}

/**
 * Extracts and parses word/document.xml from a .docx ArrayBuffer without external dependencies.
 */
export async function parseDocxFile(fileOrBlob) {
  const buffer = await fileOrBlob.arrayBuffer();
  const xmlString = await extractWordDocumentXml(buffer);

  if (!xmlString) {
    throw new Error('Unable to locate word/document.xml in the DOCX package.');
  }

  return convertWordXmlToHtml(xmlString);
}

/**
 * Pure JavaScript ZIP Central-Directory & Local-Header parser
 */
async function extractWordDocumentXml(buffer) {
  const view = new DataView(buffer);
  const byteLength = buffer.byteLength;

  // Search backwards for the End of Central Directory signature: 0x06054b50 ("PK\x05\x06")
  let eocdOffset = -1;
  const maxSearch = Math.min(byteLength - 22, 65557);
  for (let i = byteLength - 22; i >= byteLength - maxSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    // Fallback: search local file headers directly from start
    return await extractViaLocalHeaders(buffer, view);
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  let currentOffset = cdOffset;
  const decoder = new TextDecoder('utf-8');

  for (let i = 0; i < totalEntries && currentOffset < eocdOffset; i++) {
    if (view.getUint32(currentOffset, true) !== 0x02014b50) break; // PK\x01\x02

    const compressionMethod = view.getUint16(currentOffset + 10, true);
    const compressedSize = view.getUint32(currentOffset + 20, true);
    const nameLen = view.getUint16(currentOffset + 28, true);
    const extraLen = view.getUint16(currentOffset + 30, true);
    const commentLen = view.getUint16(currentOffset + 32, true);
    const localHeaderOffset = view.getUint32(currentOffset + 42, true);

    const nameBytes = new Uint8Array(buffer, currentOffset + 46, nameLen);
    const fileName = decoder.decode(nameBytes);

    if (fileName === 'word/document.xml') {
      // Find payload data inside local header
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

      const compressedBytes = new Uint8Array(buffer, dataOffset, compressedSize);

      if (compressionMethod === 0) {
        return decoder.decode(compressedBytes);
      } else if (compressionMethod === 8) {
        return await decompressRawDeflate(compressedBytes);
      }
    }

    currentOffset += 46 + nameLen + extraLen + commentLen;
  }

  return await extractViaLocalHeaders(buffer, view);
}

/**
 * Fallback local header scanner for non-standard ZIP archives
 */
async function extractViaLocalHeaders(buffer, view) {
  let offset = 0;
  const decoder = new TextDecoder('utf-8');
  while (offset < buffer.byteLength - 30) {
    if (view.getUint32(offset, true) === 0x04034b50) { // PK\x03\x04
      const method = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);

      const nameBytes = new Uint8Array(buffer, offset + 30, nameLen);
      const fileName = decoder.decode(nameBytes);
      const dataOffset = offset + 30 + nameLen + extraLen;

      if (fileName === 'word/document.xml') {
        const compressedBytes = new Uint8Array(buffer, dataOffset, compSize);
        if (method === 0) {
          return decoder.decode(compressedBytes);
        } else if (method === 8) {
          return await decompressRawDeflate(compressedBytes);
        }
      }

      offset = dataOffset + compSize;
    } else {
      offset++;
    }
  }
  return null;
}

/**
 * Decompresses raw deflate streams using native browser DecompressionStream
 */
async function decompressRawDeflate(compressedBytes) {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compressedBytes);
    writer.close();

    const reader = ds.readable.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return new TextDecoder('utf-8').decode(result);
  }

  throw new Error('DecompressionStream is not supported in this browser environment.');
}

/**
 * Converts Word document.xml DOM tree to rich HTML
 */
function convertWordXmlToHtml(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const body = xmlDoc.getElementsByTagName('w:body')[0];

  if (!body) return '<p><br></p>';

  const htmlParts = [];

  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    if (node.nodeName === 'w:p') {
      htmlParts.push(parseWordParagraph(node));
    } else if (node.nodeName === 'w:tbl') {
      htmlParts.push(parseWordTable(node));
    }
  }

  const resultHtml = htmlParts.join('\n');
  return resultHtml.trim() ? resultHtml : '<p><br></p>';
}

function parseWordParagraph(pNode) {
  // Check style (Headings h1-h6, Blockquote, Lists)
  const pPr = pNode.getElementsByTagName('w:pPr')[0];
  let tag = 'p';
  let pageBreakPrefix = '';

  if (pPr) {
    const pStyle = pPr.getElementsByTagName('w:pStyle')[0];
    if (pStyle) {
      const val = (pStyle.getAttribute('w:val') || '').toLowerCase();
      if (val.includes('heading1') || val === '1') tag = 'h1';
      else if (val.includes('heading2') || val === '2') tag = 'h2';
      else if (val.includes('heading3') || val === '3') tag = 'h3';
      else if (val.includes('heading4') || val === '4') tag = 'h4';
      else if (val.includes('heading5') || val === '5') tag = 'h5';
      else if (val.includes('heading6') || val === '6') tag = 'h6';
      else if (val.includes('quote')) tag = 'blockquote';
      else if (val.includes('list')) tag = 'li';
    }

    const numPr = pPr.getElementsByTagName('w:numPr')[0];
    if (numPr) tag = 'li';

    // Word page break before paragraph
    if (pPr.getElementsByTagName('w:pageBreakBefore').length > 0) {
      pageBreakPrefix = '\n<div class="rta-page-break-print" style="page-break-after:always;"></div>\n';
    }
  }

  const runsHtml = [];
  for (let i = 0; i < pNode.childNodes.length; i++) {
    const child = pNode.childNodes[i];
    if (child.nodeName === 'w:r') {
      runsHtml.push(parseWordRun(child));
    } else if (child.nodeName === 'w:hyperlink') {
      const linkRuns = [];
      child.childNodes.forEach(c => {
        if (c.nodeName === 'w:r') linkRuns.push(parseWordRun(c));
      });
      runsHtml.push(`<a href="#">${linkRuns.join('')}</a>`);
    }
  }

  const content = runsHtml.join('').trim();
  if (!content) return pageBreakPrefix + `<${tag}><br></${tag}>`;
  return pageBreakPrefix + `<${tag}>${content}</${tag}>`;
}

function parseWordRun(rNode) {
  const rPr = rNode.getElementsByTagName('w:rPr')[0];
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrike = false;
  let color = null;

  if (rPr) {
    isBold = rPr.getElementsByTagName('w:b').length > 0 || rPr.getElementsByTagName('w:bCs').length > 0;
    isItalic = rPr.getElementsByTagName('w:i').length > 0 || rPr.getElementsByTagName('w:iCs').length > 0;
    isUnderline = rPr.getElementsByTagName('w:u').length > 0;
    isStrike = rPr.getElementsByTagName('w:strike').length > 0;

    const colorEl = rPr.getElementsByTagName('w:color')[0];
    if (colorEl) {
      const cVal = colorEl.getAttribute('w:val');
      if (cVal && cVal !== 'auto') color = `#${cVal}`;
    }
  }

  let text = '';
  for (let i = 0; i < rNode.childNodes.length; i++) {
    const child = rNode.childNodes[i];
    if (child.nodeName === 'w:t') {
      text += escapeHtml(child.textContent || '');
    } else if (child.nodeName === 'w:br') {
      const brType = child.getAttribute('w:type');
      if (brType === 'page') {
        text += '\n<div class="rta-page-break-print" style="page-break-after:always;"></div>\n';
      } else {
        text += '<br>';
      }
    } else if (child.nodeName === 'w:lastRenderedPageBreak') {
      text += '\n<div class="rta-page-break-print" style="page-break-after:always;"></div>\n';
    } else if (child.nodeName === 'w:tab') {
      text += '&nbsp;&nbsp;&nbsp;&nbsp;';
    }
  }

  if (!text) return '';

  let out = text;
  if (isBold) out = `<strong>${out}</strong>`;
  if (isItalic) out = `<em>${out}</em>`;
  if (isUnderline) out = `<u>${out}</u>`;
  if (isStrike) out = `<s>${out}</s>`;
  if (color) out = `<span style="color: ${color};">${out}</span>`;

  return out;
}

function parseWordTable(tblNode) {
  const rows = tblNode.getElementsByTagName('w:tr');
  let tableHtml = '<table class="rta-table"><tbody>';

  for (let r = 0; r < rows.length; r++) {
    tableHtml += '<tr>';
    const cells = rows[r].getElementsByTagName('w:tc');
    for (let c = 0; c < cells.length; c++) {
      const tag = r === 0 ? 'th' : 'td';
      const paras = cells[c].getElementsByTagName('w:p');
      let cellText = '';
      for (let p = 0; p < paras.length; p++) {
        cellText += parseWordParagraph(paras[p]);
      }
      tableHtml += `<${tag}>${cellText || '&nbsp;'}</${tag}>`;
    }
    tableHtml += '</tr>';
  }

  tableHtml += '</tbody></table>';
  return tableHtml;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

function markdownToHtmlSimple(md) {
  if (!md) return '<p><br></p>';
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/~~(.*?)~~/gim, '<del>$1</del>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/gim, '</p><p>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');
}
