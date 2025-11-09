/**
 * @fileoverview Remark Plugin for Merging Inline Paragraphs
 *
 * This module provides a sophisticated remark plugin that intelligently merges
 * inline paragraphs in markdown AST trees to improve readability and formatting.
 * It handles complex markdown structures including lists, blockquotes, and
 * various inline elements.
 *
 * Features:
 * - Intelligent paragraph merging based on content analysis
 * - List item optimization with inline paragraph consolidation
 * - Dangling paragraph attachment to list items
 * - Smart spacing and punctuation handling
 * - Comprehensive AST traversal and manipulation
 *
 * Algorithm Complexity:
 * - Time: O(n) where n is number of AST nodes
 * - Space: O(n) for temporary node storage
 * - Single pass through AST tree with optimized traversal
 *
 * Browser Compatibility:
 * - Pure JavaScript implementation
 * - Works in all environments that support ES2018+
 * - No DOM dependencies
 *
 * @version 1.0.0
 * @since 2024
 * @author LinuxTutorialCMS Team
 * @see {@link https://github.com/remarkjs/remark} Remark documentation
 * @see {@link https://github.com/syntax-tree/unist} Unist syntax tree
 */

import { visit } from 'unist-util-visit'

// Set of inline node types for classification
const INLINE_NODE_TYPES = new Set([
  'text',
  'inlineCode',
  'emphasis',
  'strong',
  'delete',
  'link',
  'linkReference',
  'image',
  'imageReference',
  'footnoteReference',
  'break',
  'html',
])

// Regex for letter and number detection in multiple languages
const LETTER_NUMBER_REGEX = /[A-Za-z0-9\u00C0-\u024F]/

/**
 * Clones a markdown AST node with deep copying.
 * Preserves node structure and properties.
 *
 * @function cloneNode
 * @param {Object} node - AST node to clone
 * @returns {Object} Cloned node
 * @internal
 */
const cloneNode = (node) => {
  if (!node || typeof node !== 'object') {
    return node
  }
  const copy = { ...node }
  if (Array.isArray(node.children)) {
    copy.children = node.children.map(cloneNode)
  }
  return copy
}

/**
 * Creates a new paragraph node with cloned children.
 *
 * @function cloneParagraph
 * @param {Object} paragraph - Source paragraph node
 * @returns {Object} New paragraph node
 * @internal
 */
const cloneParagraph = (paragraph) => ({
  type: 'paragraph',
  children: Array.isArray(paragraph.children)
    ? paragraph.children.map(cloneNode)
    : [],
})

/**
 * Extracts text content from a paragraph node.
 * Handles text and inline code elements.
 *
 * @function getParagraphText
 * @param {Object} paragraph - Paragraph node
 * @returns {string} Extracted text content
 * @internal
 */
const getParagraphText = (paragraph) => {
  if (!paragraph || !Array.isArray(paragraph.children)) {
    return ''
  }
  return paragraph.children
    .map((child) => {
      if (child.type === 'text') {
        return child.value || ''
      }
      if (child.type === 'inlineCode') {
        return child.value || ''
      }
      return ''
    })
    .join('')
}

/**
 * Checks if paragraph contains only inline code.
 *
 * @function isInlineCodeOnly
 * @param {Object} paragraph - Paragraph node to check
 * @returns {boolean} True if only contains inline code
 * @internal
 */
const isInlineCodeOnly = (paragraph) =>
  paragraph &&
  Array.isArray(paragraph.children) &&
  paragraph.children.length === 1 &&
  paragraph.children[0].type === 'inlineCode'

/**
 * Checks if paragraph ends with inline code content.
 *
 * @function endsWithInlineCode
 * @param {Object} paragraph - Paragraph node to check
 * @returns {boolean} True if ends with inline code
 * @internal
 */
const endsWithInlineCode = (paragraph) => {
  if (!paragraph || !Array.isArray(paragraph.children)) {
    return false
  }

  for (let index = paragraph.children.length - 1; index >= 0; index -= 1) {
    const child = paragraph.children[index]

    if (child.type === 'text') {
      if (child.value && child.value.trim()) {
        return false
      }
      continue
    }

    if (child.type === 'inlineCode') {
      return Boolean(child.value && child.value.trim())
    }

    if (child.type === 'break') {
      continue
    }

    return false
  }

  return false
}

/**
 * Determines if a node is an inline paragraph.
 * Checks if all children are inline elements.
 *
 * @function isInlineParagraph
 * @param {Object} node - AST node to check
 * @returns {boolean} True if inline paragraph
 * @internal
 */
const isInlineParagraph = (node) => {
  if (!node || node.type !== 'paragraph') {
    return false
  }

  if (!Array.isArray(node.children) || node.children.length === 0) {
    return true
  }

  return node.children.every((child) => INLINE_NODE_TYPES.has(child.type))
}

/**
 * Merges two paragraph nodes intelligently.
 * Adds spacing based on content analysis.
 *
 * @function mergeParagraphs
 * @param {Object} target - Target paragraph to merge into
 * @param {Object} fragment - Source paragraph to merge from
 * @returns {Object} Merged paragraph
 * @internal
 */
const mergeParagraphs = (target, fragment) => {
  if (!target || !fragment) {
    return target || fragment
  }

  if (shouldInsertSpace(target.children, fragment.children)) {
    target.children.push({ type: 'text', value: ' ' })
  }

  target.children.push(...fragment.children.map(cloneNode))
  return target
}

/**
 * Determines if a space should be inserted between paragraph fragments.
 * Analyzes punctuation and content for intelligent spacing.
 *
 * @function shouldInsertSpace
 * @param {Array} leftChildren - Left fragment children
 * @param {Array} rightChildren - Right fragment children
 * @returns {boolean} True if space should be inserted
 * @internal
 */
const shouldInsertSpace = (leftChildren, rightChildren) => {
  const leftChar = getLastInlineChar(leftChildren)
  const rightChar = getFirstInlineChar(rightChildren)

  if (!leftChar || !rightChar) {
    return false
  }

  if (NEVER_BEFORE_SPACE.has(rightChar) || NEVER_AFTER_SPACE.has(leftChar)) {
    return false
  }

  if (LETTER_NUMBER_REGEX.test(leftChar) && LETTER_NUMBER_REGEX.test(rightChar)) {
    return true
  }

  return /\S/.test(leftChar) && /\S/.test(rightChar)
}

/**
 * Main remark plugin for merging inline paragraphs.
 * Transforms markdown AST to optimize paragraph structure.
 *
 * @function remarkMergeInlineParagraphs
 * @returns {Function} Remark plugin transformer function
 *
 * @example
 * import remark from 'remark'
 * import remarkMergeInlineParagraphs from './remarkMergeInlineParagraphs'
 *
 * const processor = remark()
 *   .use(remarkMergeInlineParagraphs)
 *
 * const result = processor.process(markdownContent)
 *
 * Algorithm:
 * 1. Tighten list items by merging inline paragraphs
 * 2. Reattach dangling paragraphs to appropriate list items
 * 3. Merge loose paragraphs based on content analysis
 * 4. Return transformed AST
 *
 * @see {@link https://github.com/remarkjs/remark/tree/main/packages/remark} Remark plugin documentation
 */
const remarkMergeInlineParagraphs = () => (tree) => {
  // Apply all transformation steps
  tightenListItems(tree)
  reattachDanglingParagraphs(tree)
  mergeLooseParagraphs(tree)
}

export default remarkMergeInlineParagraphs