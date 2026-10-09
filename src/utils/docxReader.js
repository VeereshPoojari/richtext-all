/**
 * docxReader.js - Zero-Dependency Microsoft Word (.docx) & Document Importer
 * Parses .docx ZIP packages (XML, relationships, embedded media images, hyperlinks),
 * Word HTML, Markdown, and Text files directly in the browser.
 * (c) 2026 Veeresh Poojari <veeresha3993@gmail.com>
 * MIT Licensed
 */

import { escapeHtml, sanitizeHtml, sanitizeUrl } from './security.js';

/**
 * Reads any document file (docx, doc, md, html, txt) and returns editable HTML.
 */
export async function readDocumentFile(file) {
  if (!file) throw new Error('No file provided');

  const fileName = (file.name || '').toLowerCase();
  let rawHtml = '';

  // 1. DOCX File
  if (fileName.endsWith('.docx')) {
    rawHtml = await parseDocxFile(file);
  }
  // 2. Legacy Word .doc or HTML
  else if (fileName.endsWith('.doc') || fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    const text = await readFileAsText(file);
    if ((text.includes('<body') || text.includes('<html')) && typeof DOMParser !== 'undefined') {
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
 * Automatically splits multi-page content into physical/visual pages
 * using <div class="rta-page-break-print"> page separators.
 */
export function autoPaginateHtml(html, wordsPerPage = 320) {
  if (!html) return '<p><br></p>';

  // Split into sections by existing page breaks if any exist
  const hasBreaks = html.includes('rta-page-break-print') || html.includes('rta-page-break');
  if (hasBreaks) {
    const breakRegex = /<div class="rta-page-break(?:-print)?"[^>]*><\/div>/gi;
    const rawSections = html.split(breakRegex);
    let anyNeedsSplit = false;
    for (const sec of rawSections) {
      if (!sec.trim()) continue;
      const plainText = sec.replace(/<[^>]+>/g, ' ').trim();
      const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
      if (words > wordsPerPage) {
        anyNeedsSplit = true;
        break;
      }
    }

    if (!anyNeedsSplit) {
      return html;
    }

    const paginatedSections = [];
    for (const sec of rawSections) {
      if (!sec.trim()) continue;
      const sub = paginateSingleSection(sec, wordsPerPage);
      paginatedSections.push(sub.join('\n<div class="rta-page-break-print" style="page-break-after:always;"></div>\n'));
    }

    if (paginatedSections.length <= 1) return paginatedSections[0] || html;
    return paginatedSections.join('\n<div class="rta-page-break-print" style="page-break-after:always;"></div>\n');
  }

  const pages = paginateSingleSection(html, wordsPerPage);
  if (pages.length <= 1) return html;
  return pages.join('\n<div class="rta-page-break-print" style="page-break-after:always;"></div>\n');
}

function paginateSingleSection(sectionHtml, wordsPerPage = 320) {
  if (!sectionHtml || !sectionHtml.trim()) return [];

  // 1. In browser environments with DOMParser, split based on parsed DOM structure
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${sectionHtml}</body>`, 'text/html');
      const children = Array.from(doc.body.children);
      if (children.length > 0) {
        const pages = [];
        let curElems = [];
        let curWeight = 0;

        for (const el of children) {
          const text = el.textContent || '';
          const wordCount = text.split(/\s+/).filter(Boolean).length;
          let weight = wordCount;

          if (el.nodeName === 'TABLE' || el.classList.contains('rta-table-wrap')) {
            const rows = el.querySelectorAll ? el.querySelectorAll('tr').length : 3;
            weight = Math.max(80, rows * 25);
          } else if (el.nodeName === 'FIGURE' || el.querySelector?.('img')) {
            weight = Math.max(90, weight + 70);
          }

          if (curWeight > 0 && (curWeight + weight > wordsPerPage || curElems.length >= 14)) {
            pages.push(curElems.map(e => e.outerHTML).join('\n'));
            curElems = [el];
            curWeight = weight;
          } else {
            curElems.push(el);
            curWeight += weight;
          }
        }

        if (curElems.length > 0) {
          pages.push(curElems.map(e => e.outerHTML).join('\n'));
        }

        if (pages.length > 0) return pages;
      }
    } catch {}
  }

  // 2. Regex fallback for Node.js test environments or non-DOM parsers
  const blocks = sectionHtml.match(/<(p|h[1-6]|table|blockquote|ul|ol|pre|div|figure)[^>]*>[\s\S]*?<\/\1>/gi);
  if (!blocks || blocks.length <= 4) return [sectionHtml];

  let pages = [];
  let currentWords = 0;
  let currentPageBlocks = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const plainText = block.replace(/<[^>]+>/g, ' ').trim();
    const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const weight = block.includes('<table') ? Math.max(80, wordCount) : (block.includes('<img') ? Math.max(90, wordCount) : wordCount);

    if (currentWords > 0 && (currentWords + weight > wordsPerPage || currentPageBlocks.length >= 14)) {
      pages.push(currentPageBlocks.join('\n'));
      currentPageBlocks = [block];
      currentWords = weight;
    } else {
      currentPageBlocks.push(block);
      currentWords += weight;
    }
  }

  if (currentPageBlocks.length > 0) {
    pages.push(currentPageBlocks.join('\n'));
  }

  return pages.length > 0 ? pages : [sectionHtml];
}

/**
 * Extracts and parses word/document.xml, relationships, and embedded media from a .docx.
 */
export async function parseDocxFile(fileOrBlob) {
  let buffer;
  if (fileOrBlob && typeof fileOrBlob.arrayBuffer === 'function') {
    buffer = await fileOrBlob.arrayBuffer();
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileOrBlob)) {
    buffer = fileOrBlob.buffer.slice(fileOrBlob.byteOffset, fileOrBlob.byteOffset + fileOrBlob.byteLength);
  } else if (fileOrBlob instanceof ArrayBuffer) {
    buffer = fileOrBlob;
  } else if (fileOrBlob && fileOrBlob.buffer instanceof ArrayBuffer) {
    buffer = fileOrBlob.buffer;
  } else if (typeof FileReader !== 'undefined') {
    buffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(fileOrBlob);
    });
  } else {
    throw new Error('Unsupported file/buffer format for DOCX parsing.');
  }

  const pkg = await extractDocxPackage(buffer);

  if (!pkg.documentXml) {
    throw new Error('Unable to locate word/document.xml in the DOCX package.');
  }

  return convertWordXmlToHtml(pkg.documentXml, pkg.relationships, pkg.media);
}

/**
 * Pure JavaScript ZIP Package extractor that parses:
 * - word/document.xml
 * - word/_rels/document.xml.rels
 * - word/media/* (embedded images)
 */
async function extractDocxPackage(buffer) {
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

  const result = {
    documentXml: null,
    relationships: new Map(), // rId -> { target, type }
    media: new Map()          // normalized path -> dataUrl
  };

  const decoder = new TextDecoder('utf-8');
  let relsXml = null;

  if (eocdOffset !== -1) {
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let currentOffset = cdOffset;

    for (let i = 0; i < totalEntries && currentOffset < eocdOffset; i++) {
      if (view.getUint32(currentOffset, true) !== 0x02014b50) break; // PK\x01\x02

      const compressionMethod = view.getUint16(currentOffset + 10, true);
      const compressedSize = view.getUint32(currentOffset + 20, true);
      const uncompressedSize = view.getUint32(currentOffset + 24, true);
      const nameLen = view.getUint16(currentOffset + 28, true);
      const extraLen = view.getUint16(currentOffset + 30, true);
      const commentLen = view.getUint16(currentOffset + 32, true);
      const localHeaderOffset = view.getUint32(currentOffset + 42, true);

      const nameBytes = new Uint8Array(buffer, currentOffset + 46, nameLen);
      const fileName = decoder.decode(nameBytes);

      // Locate data in local header
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedBytes = new Uint8Array(buffer, dataOffset, compressedSize);

      if (fileName === 'word/document.xml') {
        result.documentXml = await decompressBytes(compressedBytes, compressionMethod, uncompressedSize);
      } else if (fileName === 'word/_rels/document.xml.rels') {
        relsXml = await decompressBytes(compressedBytes, compressionMethod, uncompressedSize);
      } else if (fileName.startsWith('word/media/') && compressedSize > 0) {
        try {
          const rawBytes = await decompressToUint8Array(compressedBytes, compressionMethod, uncompressedSize);
          const mime = getMimeTypeFromFilename(fileName);
          const dataUrl = `data:${mime};base64,${uint8ArrayToBase64(rawBytes)}`;
          result.media.set(fileName, dataUrl);
          // Also set simple basename (e.g. "image1.png")
          const baseName = fileName.replace('word/media/', '');
          result.media.set(baseName, dataUrl);
          result.media.set(`media/${baseName}`, dataUrl);
        } catch (err) {
          console.warn(`[richtext-all] Failed to decompress image ${fileName}:`, err);
        }
      }

      currentOffset += 46 + nameLen + extraLen + commentLen;
    }
  }

  // Fallback if EOCD was missing or documentXml not found
  if (!result.documentXml) {
    const fallback = await extractViaLocalHeadersAll(buffer, view);
    result.documentXml = fallback.documentXml;
    if (fallback.relsXml) relsXml = fallback.relsXml;
    fallback.media.forEach((v, k) => result.media.set(k, v));
  }

  // Parse Relationships XML
  if (relsXml) {
    try {
      const parser = new DOMParser();
      const rDoc = parser.parseFromString(relsXml, 'text/xml');
      const relElements = rDoc.getElementsByTagName('Relationship');
      for (let r = 0; r < relElements.length; r++) {
        const el = relElements[r];
        const id = el.getAttribute('Id');
        const target = el.getAttribute('Target') || '';
        const type = el.getAttribute('Type') || '';
        if (id) {
          result.relationships.set(id, { id, target, type });
        }
      }
    } catch (err) {
      console.warn('[richtext-all] Error parsing document.xml.rels:', err);
    }
  }

  return result;
}

/**
 * Fallback scanner for non-standard ZIP archives
 */
async function extractViaLocalHeadersAll(buffer, view) {
  let offset = 0;
  const decoder = new TextDecoder('utf-8');
  const res = { documentXml: null, relsXml: null, media: new Map() };

  while (offset < buffer.byteLength - 30) {
    if (view.getUint32(offset, true) === 0x04034b50) { // PK\x03\x04
      const method = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const uncompSize = view.getUint32(offset + 22, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);

      const nameBytes = new Uint8Array(buffer, offset + 30, nameLen);
      const fileName = decoder.decode(nameBytes);
      const dataOffset = offset + 30 + nameLen + extraLen;

      if (fileName === 'word/document.xml') {
        const compressedBytes = new Uint8Array(buffer, dataOffset, compSize);
        res.documentXml = await decompressBytes(compressedBytes, method, uncompSize);
      } else if (fileName === 'word/_rels/document.xml.rels') {
        const compressedBytes = new Uint8Array(buffer, dataOffset, compSize);
        res.relsXml = await decompressBytes(compressedBytes, method, uncompSize);
      } else if (fileName.startsWith('word/media/') && compSize > 0) {
        try {
          const compressedBytes = new Uint8Array(buffer, dataOffset, compSize);
          const rawBytes = await decompressToUint8Array(compressedBytes, method, uncompSize);
          const mime = getMimeTypeFromFilename(fileName);
          const dataUrl = `data:${mime};base64,${uint8ArrayToBase64(rawBytes)}`;
          res.media.set(fileName, dataUrl);
          const baseName = fileName.replace('word/media/', '');
          res.media.set(baseName, dataUrl);
          res.media.set(`media/${baseName}`, dataUrl);
        } catch {}
      }

      offset = dataOffset + compSize;
    } else {
      offset++;
    }
  }
  return res;
}

async function decompressBytes(compressedBytes, method, uncompressedSize) {
  if (method === 0) {
    return new TextDecoder('utf-8').decode(compressedBytes);
  } else if (method === 8) {
    return await decompressRawDeflate(compressedBytes);
  }
  return null;
}

async function decompressToUint8Array(compressedBytes, method, uncompressedSize) {
  if (method === 0) {
    return compressedBytes;
  } else if (method === 8) {
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
      return result;
    }
    throw new Error('DecompressionStream is not supported');
  }
  return compressedBytes;
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

function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, len));
    binary += String.fromCharCode.apply(null, sub);
  }
  return btoa(binary);
}

function getMimeTypeFromFilename(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'webp': return 'image/webp';
    case 'bmp': return 'image/bmp';
    default: return 'image/png';
  }
}

/**
 * Converts Word document.xml DOM tree to rich HTML, embedding real images and hyperlinks.
 */
function convertWordXmlToHtml(xmlText, relationships = new Map(), mediaMap = new Map()) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const body = xmlDoc.getElementsByTagName('w:body')[0];

  if (!body) return '<p><br></p>';

  const htmlParts = [];
  const totalNodes = body.childNodes.length;

  for (let i = 0; i < totalNodes; i++) {
    const node = body.childNodes[i];
    if (node.nodeName === 'w:p') {
      htmlParts.push(parseWordParagraph(node, relationships, mediaMap));
    } else if (node.nodeName === 'w:tbl') {
      htmlParts.push(parseWordTable(node, relationships, mediaMap));
    }
  }

  const resultHtml = htmlParts.join('\n');
  return resultHtml.trim() ? resultHtml : '<p><br></p>';
}

function parseWordParagraph(pNode, relationships, mediaMap) {
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

    // Explicit Word page break before paragraph
    if (pPr.getElementsByTagName('w:pageBreakBefore').length > 0) {
      pageBreakPrefix = '\n<div class="rta-page-break-print" style="page-break-after:always;"></div>\n';
    }
  }

  const runsHtml = [];
  for (let i = 0; i < pNode.childNodes.length; i++) {
    const child = pNode.childNodes[i];
    if (child.nodeName === 'w:r') {
      runsHtml.push(parseWordRun(child, relationships, mediaMap));
    } else if (child.nodeName === 'w:hyperlink') {
      const rId = child.getAttribute('r:id') || child.getAttribute('id');
      let href = '#';
      if (rId && relationships.has(rId)) {
        href = relationships.get(rId).target || '#';
      }
      const safeHref = sanitizeUrl(href);
      const linkRuns = [];
      child.childNodes.forEach(c => {
        if (c.nodeName === 'w:r') linkRuns.push(parseWordRun(c, relationships, mediaMap));
      });
      runsHtml.push(`<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${linkRuns.join('') || safeHref}</a>`);
    } else if (child.nodeName === 'w:drawing' || child.nodeName === 'w:pict') {
      const imgHtml = extractImageFromDrawing(child, relationships, mediaMap);
      if (imgHtml) runsHtml.push(imgHtml);
    }
  }

  const content = runsHtml.join('').trim();
  if (!content) return pageBreakPrefix + `<${tag}><br></${tag}>`;
  return pageBreakPrefix + `<${tag}>${content}</${tag}>`;
}

function parseWordRun(rNode, relationships, mediaMap) {
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
  let embeddedImages = '';

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
    } else if (child.nodeName === 'w:drawing' || child.nodeName === 'w:pict') {
      const imgHtml = extractImageFromDrawing(child, relationships, mediaMap);
      if (imgHtml) embeddedImages += imgHtml;
    }
  }

  if (!text && !embeddedImages) return '';

  let out = text;
  if (out) {
    if (isBold) out = `<strong>${out}</strong>`;
    if (isItalic) out = `<em>${out}</em>`;
    if (isUnderline) out = `<u>${out}</u>`;
    if (isStrike) out = `<s>${out}</s>`;
    if (color) out = `<span style="color: ${color};">${out}</span>`;
  }

  return out + embeddedImages;
}

/**
 * Extracts embedded images from drawing or pict XML nodes.
 */
function extractImageFromDrawing(drawNode, relationships, mediaMap) {
  // 1. Look for modern <a:blip r:embed="rIdX" />
  const blips = drawNode.getElementsByTagName('a:blip');
  for (let i = 0; i < blips.length; i++) {
    const rId = blips[i].getAttribute('r:embed') || blips[i].getAttribute('r:link');
    if (rId && relationships.has(rId)) {
      const target = relationships.get(rId).target || '';
      const imgUrl = mediaMap.get(target) || mediaMap.get(`word/${target}`) || mediaMap.get(target.replace(/^\/?word\//, '')) || target;
      if (imgUrl) {
        return `<figure class="rta-image-wrap"><img src="${imgUrl}" alt="Document Image" class="rta-image" /></figure>`;
      }
    }
  }

  // 2. Look for legacy VML <v:imagedata r:id="rIdX" />
  const imgDatas = drawNode.getElementsByTagName('v:imagedata');
  for (let i = 0; i < imgDatas.length; i++) {
    const rId = imgDatas[i].getAttribute('r:id');
    if (rId && relationships.has(rId)) {
      const target = relationships.get(rId).target || '';
      const imgUrl = mediaMap.get(target) || mediaMap.get(`word/${target}`) || mediaMap.get(target.replace(/^\/?word\//, '')) || target;
      if (imgUrl) {
        return `<figure class="rta-image-wrap"><img src="${imgUrl}" alt="Document Image" class="rta-image" /></figure>`;
      }
    }
  }

  return '';
}

function parseWordTable(tblNode, relationships, mediaMap) {
  const rows = tblNode.getElementsByTagName('w:tr');
  let tableHtml = '<div class="rta-table-wrap"><table class="rta-table"><tbody>';

  for (let r = 0; r < rows.length; r++) {
    tableHtml += '<tr>';
    const cells = rows[r].getElementsByTagName('w:tc');
    for (let c = 0; c < cells.length; c++) {
      const tag = r === 0 ? 'th' : 'td';
      const paras = cells[c].getElementsByTagName('w:p');
      let cellText = '';
      for (let p = 0; p < paras.length; p++) {
        cellText += parseWordParagraph(paras[p], relationships, mediaMap);
      }
      tableHtml += `<${tag}>${cellText || '&nbsp;'}</${tag}>`;
    }
    tableHtml += '</tr>';
  }

  tableHtml += '</tbody></table></div>';
  return tableHtml;
}

async function readFileAsText(file) {
  if (file && typeof file.text === 'function') {
    return await file.text();
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(file)) {
    return file.toString('utf-8');
  }
  if (file instanceof ArrayBuffer) {
    return new TextDecoder('utf-8').decode(file);
  }
  if (typeof file === 'string') {
    return file;
  }
  return String(file || '');
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
