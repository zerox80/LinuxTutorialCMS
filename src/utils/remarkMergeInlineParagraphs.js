import { visit } from 'unist-util-visit'

/**
 * Set of AST node types that are considered inline content.
 *
 * These node types represent text-level elements that can appear
 * within a paragraph without breaking the inline flow.
 *
 * @constant {Set<string>}
 * @readonly
 */
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

/**
 * Regular expression matching letters and numbers including Unicode characters.
 *
 * Used to determine if characters should be separated by spaces when
 * merging paragraphs. Includes Latin alphabet and extended Latin characters.
 *
 * @constant {RegExp}
 * @readonly
 */
const LETTER_NUMBER_REGEX = /[A-Za-z0-9\u00C0-\u024F]/

/**
 * Deep clones an AST node with all its properties and children.
 *
 * Creates a recursive copy of a markdown AST node to avoid mutating
 * the original tree structure during paragraph merging operations.
 *
 * @param {*} node - The AST node to clone
 * @returns {*} A deep copy of the node
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
 * Creates a new paragraph node with cloned children from an existing paragraph.
 *
 * @param {object} paragraph - The paragraph node to clone
 * @returns {object} A new paragraph node with cloned children
 */
const cloneParagraph = (paragraph) => ({
  type: 'paragraph',
  children: Array.isArray(paragraph.children)
    ? paragraph.children.map(cloneNode)
    : [],
})

/**
 * Extracts plain text content from a paragraph node.
 *
 * Concatenates text from text nodes and inline code nodes, ignoring
 * other inline elements like links and images.
 *
 * @param {object} paragraph - The paragraph node to extract text from
 * @returns {string} The concatenated text content
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
 * Checks if a paragraph contains only inline code content.
 *
 * This is used to identify paragraphs that should be merged with
 * surrounding text, as inline code typically flows naturally with
 * adjacent content.
 *
 * @param {object} paragraph - The paragraph node to check
 * @returns {boolean} True if the paragraph contains only inline code
 */
const isInlineCodeOnly = (paragraph) =>
  paragraph &&
  Array.isArray(paragraph.children) &&
  paragraph.children.length === 1 &&
  paragraph.children[0].type === 'inlineCode'

/**
 * Checks if a paragraph ends with inline code content.
 *
 * Traverses the paragraph children from right to left to find the
 * last meaningful content node. If it's inline code with content,
 * returns true to prevent merging with subsequent paragraphs.
 *
 * @param {object} paragraph - The paragraph node to check
 * @returns {boolean} True if the paragraph ends with inline code
 */
const endsWithInlineCode = (paragraph) => {
  if (!paragraph || !Array.isArray(paragraph.children)) {
    return false
  }

  // Traverse backwards to find the last meaningful content
  for (let index = paragraph.children.length - 1; index >= 0; index -= 1) {
    const child = paragraph.children[index]

    // Skip empty text nodes
    if (child.type === 'text') {
      if (child.value && child.value.trim()) {
        // Found non-empty text, so doesn't end with inline code
        return false
      }
      continue
    }

    // Found inline code - check if it has content
    if (child.type === 'inlineCode') {
      return Boolean(child.value && child.value.trim())
    }

    // Skip line breaks
    if (child.type === 'break') {
      continue
    }

    // Any other element type means it doesn't end with inline code
    return false
  }

  return false
}

/**
 * Determines if a paragraph contains only inline content.
 *
 * A paragraph is considered "inline" if all its children are inline-level
 * elements (text, emphasis, links, etc.) rather than block-level elements.
 * Empty paragraphs are also considered inline.
 *
 * @param {object} node - The AST node to check
 * @returns {boolean} True if the node is a paragraph with only inline content
 */
const isInlineParagraph = (node) => {
  if (!node || node.type !== 'paragraph') {
    return false
  }
  // Empty paragraphs are considered inline
  if (!Array.isArray(node.children) || node.children.length === 0) {
    return true
  }
  // Check that all children are inline node types
  return node.children.every((child) => INLINE_NODE_TYPES.has(child.type))
}

/**
 * Extracts the last non-whitespace character from a list of inline children.
 *
 * Searches through children from right to left, looking at text and inlineCode
 * nodes to find the last meaningful character. Used to determine spacing
 * when merging paragraphs.
 *
 * @param {Array<object>} children - Array of inline AST nodes
 * @returns {string|null} The last character found, or null if none
 */
const getLastInlineChar = (children) => {
  // Search backwards to find the last meaningful content
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const child = children[i]

    // Check text nodes for non-whitespace content
    if (child.type === 'text' && child.value) {
      const trimmed = child.value.trimEnd()
      if (trimmed) {
        return trimmed[trimmed.length - 1]
      }
    }

    // Check inline code nodes for content
    if (child.type === 'inlineCode' && child.value) {
      const trimmed = child.value.trimEnd()
      if (trimmed) {
        return trimmed[trimmed.length - 1]
      }
    }
  }
  return null
}

/**
 * Extracts the first non-whitespace character from a list of inline children.
 *
 * Searches through children from left to right, looking at text and inlineCode
 * nodes to find the first meaningful character. Used to determine spacing
 * when merging paragraphs.
 *
 * @param {Array<object>} children - Array of inline AST nodes
 * @returns {string|null} The first character found, or null if none
 */
const getFirstInlineChar = (children) => {
  // Search forwards to find the first meaningful content
  for (const child of children) {
    // Check text nodes for non-whitespace content
    if (child.type === 'text' && child.value) {
      const trimmed = child.value.trimStart()
      if (trimmed) {
        return trimmed[0]
      }
    }

    // Check inline code nodes for content
    if (child.type === 'inlineCode' && child.value) {
      const trimmed = child.value.trimStart()
      if (trimmed) {
        return trimmed[0]
      }
    }
  }
  return null
}

/**
 * Characters that should never have a space before them.
 * These are punctuation marks that naturally connect to preceding content.
 *
 * @constant {Set<string>}
 * @readonly
 */
const NEVER_BEFORE_SPACE = new Set([',', '.', ';', ':', ')', ']', '}', '?'])

/**
 * Characters that should never have a space after them.
 * These are opening brackets/braces that naturally connect to following content.
 *
 * @constant {Set<string>}
 * @readonly
 */
const NEVER_AFTER_SPACE = new Set(['(', '[', '{'])

/**
 * Determines whether to insert a space when merging two inline content sections.
 *
 * Uses character-based heuristics to decide if spacing is appropriate:
 * - Never spaces before punctuation like commas, periods
 * - Never spaces after opening brackets/braces
 * - Always spaces between consecutive letters/numbers
 * - Otherwise, only if both characters are non-whitespace
 *
 * @param {Array<object>} leftChildren - Children from the left section
 * @param {Array<object>} rightChildren - Children from the right section
 * @returns {boolean} True if a space should be inserted between the sections
 */
const shouldInsertSpace = (leftChildren, rightChildren) => {
  const leftChar = getLastInlineChar(leftChildren)
  const rightChar = getFirstInlineChar(rightChildren)

  // If we can't determine characters, don't insert space
  if (!leftChar || !rightChar) {
    return false
  }

  // Respect punctuation and bracket spacing rules
  if (NEVER_BEFORE_SPACE.has(rightChar) || NEVER_AFTER_SPACE.has(leftChar)) {
    return false
  }

  // Always space between consecutive letters and numbers
  if (LETTER_NUMBER_REGEX.test(leftChar) && LETTER_NUMBER_REGEX.test(rightChar)) {
    return true
  }

  // Otherwise, only space if both characters are non-whitespace
  return /\S/.test(leftChar) && /\S/.test(rightChar)
}

/**
 * Merges two paragraph nodes by concatenating their children.
 *
 * Handles spacing logic by inserting a space character if needed based on
 * the ending character of the target paragraph and the starting character
 * of the fragment paragraph. Clones the fragment children to avoid
 * mutating the original AST.
 *
 * @param {object} target - The target paragraph to merge into
 * @param {object} fragment - The source paragraph to merge from
 * @returns {object} The merged target paragraph (modified in-place)
 */
const mergeParagraphs = (target, fragment) => {
  if (!target || !fragment) {
    return target || fragment
  }

  // Insert appropriate spacing if needed
  if (shouldInsertSpace(target.children, fragment.children)) {
    target.children.push({ type: 'text', value: ' ' })
  }

  // Clone and append all children from fragment
  target.children.push(...fragment.children.map(cloneNode))
  return target
}

/**
 * Finds the last paragraph node within a list item.
 *
 * Searches through a list item's children from right to left to find
 * the last paragraph node. This is used to determine where to attach
 * dangling inline content in list items.
 *
 * @param {object} listItem - The list item node to search
 * @returns {object|null} The last paragraph node, or null if none found
 */
const getLastParagraphFromItem = (listItem) => {
  if (!Array.isArray(listItem.children)) {
    return null
  }

  // Search backwards to find the last paragraph
  for (let i = listItem.children.length - 1; i >= 0; i -= 1) {
    const child = listItem.children[i]
    if (child.type === 'paragraph') {
      return child
    }
  }
  return null
}

/**
 * Attaches a paragraph fragment to a list item by merging it with an existing paragraph
 * or creating a new one if needed.
 *
 * This function handles the complex logic of attaching inline content that appears
 * after list items (dangling paragraphs) by either merging with the last existing
 * paragraph in the list item or creating a new paragraph.
 *
 * @param {object} listItem - The list item to attach the fragment to
 * @param {object} fragment - The paragraph fragment to attach
 * @returns {void}
 */
const attachFragmentToListItem = (listItem, fragment) => {
  if (!listItem || !fragment) {
    return
  }

  // Find or create a target paragraph to merge into
  const target = getLastParagraphFromItem(listItem) || (() => {
    // Create a new paragraph if none exists in the list item
    const paragraph = cloneParagraph(fragment)
    listItem.children = Array.isArray(listItem.children) ? listItem.children : []
    listItem.children.push(paragraph)
    return paragraph
  })()

  // Prevent self-merge (fragment is already the target)
  if (target === fragment) {
    return
  }

  // Merge the fragment into the target paragraph
  mergeParagraphs(target, fragment)
}

/**
 * Tightens list items by merging consecutive inline paragraphs within them.
 *
 * This function processes all list items in the AST, looking for sequences of
 * inline-only paragraphs that should be merged together. It uses a buffer
 * pattern to collect consecutive inline paragraphs and merge them efficiently.
 *
 * @param {import('mdast').Root} tree - The Markdown AST to process
 * @returns {void}
 */
const tightenListItems = (tree) => {
  visit(tree, 'listItem', (listItem) => {
    // Skip list items that don't have multiple children
    if (!Array.isArray(listItem.children) || listItem.children.length <= 1) {
      return
    }

    const normalized = []
    let buffer = null

    // Process each child in the list item
    for (const child of listItem.children) {
      // If the child is an inline paragraph, add it to the buffer
      if (isInlineParagraph(child)) {
        buffer = buffer ? mergeParagraphs(buffer, child) : cloneParagraph(child)
        continue
      }

      // Flush the buffer when we encounter a non-inline paragraph
      if (buffer) {
        normalized.push(buffer)
        buffer = null
      }

      // Recursively process nested containers
      if (child.children) {
        tightenListItems(child)
      }

      // Add the non-inline child to the normalized list
      normalized.push(child)
    }

    // Don't forget to flush the final buffer if it exists
    if (buffer) {
      normalized.push(buffer)
    }

    // Replace the children with the normalized list
    listItem.children = normalized
  })
}

/**
 * Reattaches dangling inline paragraphs to the nearest preceding list item.
 *
 * This function handles the common pattern where inline content appears
 * after a list but should logically be attached to the last list item.
 * It tracks the most recent "attachable" item (last list item) and
 * moves any following inline paragraphs into it.
 *
 * @param {object} parent - The parent container node to process
 * @returns {void}
 */
const reattachDanglingParagraphs = (parent) => {
  if (!parent || !Array.isArray(parent.children)) {
    return
  }

  let lastAttachableItem = null

  // Iterate through children, using index to allow splicing
  for (let index = 0; index < parent.children.length; ) {
    const child = parent.children[index]

    // When we find a list, update the attachable item to its last item
    if (child.type === 'list') {
      if (Array.isArray(child.children) && child.children.length > 0) {
        lastAttachableItem = child.children[child.children.length - 1]
      } else {
        lastAttachableItem = null
      }
      // Recursively process nested content
      reattachDanglingParagraphs(child)
      index += 1
      continue
    }

    // Recursively process list items and blockquotes
    if (child.type === 'listItem' || child.type === 'blockquote') {
      reattachDanglingParagraphs(child)
    }

    // If we have an attachable item and find an inline paragraph,
    // attach it to the list item and remove it from the parent
    if (lastAttachableItem && isInlineParagraph(child)) {
      attachFragmentToListItem(lastAttachableItem, child)
      parent.children.splice(index, 1)
      continue
    }

    // Reset attachable item when we encounter non-paragraph content
    if (child.type !== 'paragraph') {
      lastAttachableItem = null
    }

    index += 1
  }
}

/**
 * Determines whether two consecutive paragraphs should be chained together.
 *
 * Uses multiple heuristics to decide if paragraphs should merge:
 * - Checks source position distance (blank lines prevent chaining)
 * - Avoids chaining when previous paragraph ends with inline code
 * - Chains paragraphs starting with punctuation, conjunctions, or lowercase
 * - Chains empty paragraphs or inline-code-only paragraphs
 *
 * @param {object} previousParagraph - The preceding paragraph node
 * @param {object} currentParagraph - The current paragraph node
 * @returns {boolean} True if the paragraphs should be chained
 */
const shouldChainParagraph = (previousParagraph, currentParagraph) => {
  if (!previousParagraph) {
    return false
  }

  // Check if there are blank lines between paragraphs
  const previousPosition = previousParagraph.position
  const currentPosition = currentParagraph.position
  if (
    previousPosition &&
    currentPosition &&
    currentPosition.start &&
    previousPosition.end &&
    currentPosition.start.line - previousPosition.end.line > 1
  ) {
    return false
  }

  // Don't chain if previous paragraph ends with inline code
  if (endsWithInlineCode(previousParagraph)) {
    return false
  }

  const currentText = getParagraphText(currentParagraph).trim()
  const previousText = getParagraphText(previousParagraph).trim()

  // Always chain empty paragraphs
  if (!currentText) {
    return true
  }

  // Always chain paragraphs that are only inline code
  if (isInlineCodeOnly(currentParagraph)) {
    return true
  }

  const firstChar = currentText[0]
  const startsWithConjunction = /^(und|oder|and|or)\b/i.test(currentText)
  const previousEndsSentence = /[.!?)]$/.test(previousText)

  // Chain if current paragraph starts with punctuation that connects
  if (/[,:;)\]]/.test(firstChar)) {
    return true
  }

  // Chain if current paragraph starts with a conjunction
  if (startsWithConjunction) {
    return true
  }

  // Chain if current paragraph starts with lowercase letter (continuation)
  if (/^[a-z\u00C0-\u024F]/.test(firstChar)) {
    return true
  }

  // Chain if previous paragraph doesn't end with sentence punctuation
  return !previousEndsSentence
}

/**
 * Merges consecutive paragraphs that should be chained together.
 *
 * This is the final merging step that chains paragraphs based on
 * linguistic and formatting heuristics. It processes children sequentially,
 * maintaining an active paragraph to merge with subsequent ones when
 * appropriate.
 *
 * @param {object} parent - The parent container node to process
 * @returns {void}
 */
const mergeLooseParagraphs = (parent) => {
  if (!parent || !Array.isArray(parent.children)) {
    return
  }

  const merged = []
  let activeParagraph = null

  // Process each child in sequence
  for (const child of parent.children) {
    // If we have an active paragraph and the current one should chain,
    // merge them and continue to the next child
    if (child.type === 'paragraph' && shouldChainParagraph(activeParagraph, child)) {
      mergeParagraphs(activeParagraph, child)
      continue
    }

    // Recursively process nested containers
    if (child.children) {
      mergeLooseParagraphs(child)
    }

    // Add the current child to the merged list
    merged.push(child)

    // Update the active paragraph reference
    activeParagraph = child.type === 'paragraph' ? child : null
  }

  // Replace the children with the merged list
  parent.children = merged
}

/**
 * Remark plugin that stitches sequences of inline-only paragraphs back together so prose flows naturally.
 *
 * This plugin addresses a common issue in markdown parsing where consecutive inline paragraphs
 * get split into separate paragraph nodes, breaking the natural flow of prose. It applies a
 * three-phase approach:
 *
 * Phase 1: tightenListItems() - Merges consecutive inline paragraphs within list items
 * Phase 2: reattachDanglingParagraphs() - Moves inline content that appears after lists into the last list item
 * Phase 3: mergeLooseParagraphs() - Chains paragraphs based on linguistic and formatting heuristics
 *
 * The plugin handles complex cases like:
 * - Inline code content that should flow with surrounding text
 * - Conjunctions and continuation phrases that naturally connect sentences
 * - Punctuation patterns that indicate content should be merged
 * - List items with trailing inline content
 *
 * @returns {(tree: import('mdast').Root) => void} Transformer function that mutates the Markdown AST in-place.
 */
const remarkMergeInlineParagraphs = () => (tree) => {
  // Phase 1: Clean up list items by merging inline paragraphs within them
  tightenListItems(tree)

  // Phase 2: Move dangling inline content into the nearest list item
  reattachDanglingParagraphs(tree)

  // Phase 3: Chain paragraphs based on linguistic and formatting cues
  mergeLooseParagraphs(tree)
}

export default remarkMergeInlineParagraphs
