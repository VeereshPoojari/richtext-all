/**
 * src/utils/diff.js - Zero-Dependency Visual Diff Engine for richtext-all
 * Computes word-level and block-level diffs between document versions.
 * Produces Side-by-Side (Left deletions in red, Right additions in green)
 * and Unified Inline Diff (merged red/green) views.
 */

import { escapeHtml } from './security.js';

/**
 * Tokenizes an HTML string into an array of HTML tags, words, whitespace, and punctuation.
 * Preserves the exact structure of the document markup.
 */
export function tokenizeHtml(html) {
  if (!html) return [];
  // Matches HTML tags, words (including unicode letters/numbers), whitespace, or other characters
  const regex = /<[^>]+>|[\w\u00C0-\u024F]+|\s+|[^\s\w<]+/g;
  return html.match(regex) || [];
}

/**
 * Computes Longest Common Subsequence (LCS) diff between two token arrays
 * with O(1) common prefix and suffix trimming optimization.
 */
export function diffTokens(tokensA, tokensB) {
  const m = tokensA.length;
  const n = tokensB.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) {
    return tokensB.map(t => ({ type: 'add', value: t }));
  }
  if (n === 0) {
    return tokensA.map(t => ({ type: 'del', value: t }));
  }

  // 1. Trim common prefix
  let start = 0;
  while (start < m && start < n && tokensA[start] === tokensB[start]) {
    start++;
  }

  // 2. Trim common suffix
  let endA = m - 1;
  let endB = n - 1;
  while (endA >= start && endB >= start && tokensA[endA] === tokensB[endB]) {
    endA--;
    endB--;
  }

  const result = [];

  // Prefix tokens
  for (let k = 0; k < start; k++) {
    result.push({ type: 'equal', value: tokensA[k] });
  }

  // 3. Middle diff using LCS
  const subA = tokensA.slice(start, endA + 1);
  const subB = tokensB.slice(start, endB + 1);

  if (subA.length > 0 && subB.length === 0) {
    for (const t of subA) result.push({ type: 'del', value: t });
  } else if (subB.length > 0 && subA.length === 0) {
    for (const t of subB) result.push({ type: 'add', value: t });
  } else if (subA.length > 0 && subB.length > 0) {
    // DP matrix
    const lenA = subA.length;
    const lenB = subB.length;
    const dp = Array.from({ length: lenA + 1 }, () => new Uint32Array(lenB + 1));

    for (let i = 0; i < lenA; i++) {
      for (let j = 0; j < lenB; j++) {
        if (subA[i] === subB[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    // Backtrack to extract diff
    const middle = [];
    let i = lenA;
    let j = lenB;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && subA[i - 1] === subB[j - 1]) {
        middle.unshift({ type: 'equal', value: subA[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        middle.unshift({ type: 'add', value: subB[j - 1] });
        j--;
      } else if (i > 0) {
        middle.unshift({ type: 'del', value: subA[i - 1] });
        i--;
      }
    }
    result.push(...middle);
  }

  // Suffix tokens
  for (let k = endA + 1; k < m; k++) {
    result.push({ type: 'equal', value: tokensA[k] });
  }

  return result;
}

/**
 * Computes complete visual diff between oldHtml and newHtml.
 * Returns { stats, leftHtml, rightHtml, unifiedHtml }.
 */
export function computeDocumentDiff(oldHtml, newHtml) {
  const cleanOld = oldHtml || '<p><br></p>';
  const cleanNew = newHtml || '<p><br></p>';

  const tokensA = tokenizeHtml(cleanOld);
  const tokensB = tokenizeHtml(cleanNew);
  const diffItems = diffTokens(tokensA, tokensB);

  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  // Calculate statistics (counting non-tag, non-whitespace words)
  diffItems.forEach(item => {
    if (!item.value.startsWith('<') && /\S/.test(item.value)) {
      if (item.type === 'add') additions++;
      else if (item.type === 'del') deletions++;
      else unchanged++;
    }
  });

  // Group adjacent text tokens of the same type for clean rendering
  const isTag = (val) => val.startsWith('<') && val.endsWith('>');

  // 1. Render Left Pane HTML (Baseline: deletions highlighted in RED)
  let leftHtml = '';
  let curDelText = '';

  const flushLeftDel = () => {
    if (curDelText) {
      leftHtml += `<del class="rta-diff-del">${curDelText}</del>`;
      curDelText = '';
    }
  };

  diffItems.forEach(item => {
    if (item.type === 'add') {
      // Additions are omitted from the baseline left pane
      return;
    }
    if (item.type === 'del') {
      if (isTag(item.value)) {
        flushLeftDel();
        // Decorate block tag with deletion indicator
        if (/^<(p|div|h[1-6]|li|blockquote)\b/i.test(item.value)) {
          leftHtml += item.value.replace(/>$/, ' class="rta-diff-block-del">');
        } else {
          leftHtml += item.value;
        }
      } else {
        curDelText += item.value;
      }
    } else {
      // Equal
      flushLeftDel();
      leftHtml += item.value;
    }
  });
  flushLeftDel();

  // 2. Render Right Pane HTML (Compared: additions highlighted in GREEN)
  let rightHtml = '';
  let curAddText = '';

  const flushRightAdd = () => {
    if (curAddText) {
      rightHtml += `<ins class="rta-diff-add">${curAddText}</ins>`;
      curAddText = '';
    }
  };

  diffItems.forEach(item => {
    if (item.type === 'del') {
      // Deletions are omitted from the compared right pane
      return;
    }
    if (item.type === 'add') {
      if (isTag(item.value)) {
        flushRightAdd();
        // Decorate block tag with addition indicator
        if (/^<(p|div|h[1-6]|li|blockquote)\b/i.test(item.value)) {
          rightHtml += item.value.replace(/>$/, ' class="rta-diff-block-add">');
        } else {
          rightHtml += item.value;
        }
      } else {
        curAddText += item.value;
      }
    } else {
      // Equal
      flushRightAdd();
      rightHtml += item.value;
    }
  });
  flushRightAdd();

  // 3. Render Unified Inline HTML (Both additions in GREEN and deletions in RED)
  let unifiedHtml = '';
  let curUniDel = '';
  let curUniAdd = '';

  const flushUni = () => {
    if (curUniDel) {
      unifiedHtml += `<del class="rta-diff-del">${curUniDel}</del>`;
      curUniDel = '';
    }
    if (curUniAdd) {
      unifiedHtml += `<ins class="rta-diff-add">${curUniAdd}</ins>`;
      curUniAdd = '';
    }
  };

  diffItems.forEach(item => {
    if (isTag(item.value)) {
      flushUni();
      if (item.type === 'del') {
        if (/^<(p|div|h[1-6]|li|blockquote)\b/i.test(item.value)) {
          unifiedHtml += item.value.replace(/>$/, ' class="rta-diff-block-del">');
        } else {
          unifiedHtml += item.value;
        }
      } else if (item.type === 'add') {
        if (/^<(p|div|h[1-6]|li|blockquote)\b/i.test(item.value)) {
          unifiedHtml += item.value.replace(/>$/, ' class="rta-diff-block-add">');
        } else {
          unifiedHtml += item.value;
        }
      } else {
        unifiedHtml += item.value;
      }
    } else {
      if (item.type === 'del') {
        curUniDel += item.value;
      } else if (item.type === 'add') {
        curUniAdd += item.value;
      } else {
        flushUni();
        unifiedHtml += item.value;
      }
    }
  });
  flushUni();

  return {
    stats: {
      additions,
      deletions,
      unchanged,
      totalChanges: additions + deletions
    },
    leftHtml: leftHtml || '<p>Empty checkpoint</p>',
    rightHtml: rightHtml || '<p>Empty document</p>',
    unifiedHtml: unifiedHtml || '<p>Empty document</p>'
  };
}
