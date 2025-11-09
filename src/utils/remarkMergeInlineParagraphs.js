import { visit } from 'unist-util-visit'

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

const LETTER_NUMBER_REGEX = /[A-Za-z0-9\u00C0-\u024F]/

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

const cloneParagraph = (paragraph) => ({
  type: 'paragraph',
  children: Array.isArray(paragraph.children)
    ? paragraph.children.map(cloneNode)
    : [],
})

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

const isInlineCodeOnly = (paragraph) =>
  paragraph &&
  Array.isArray(paragraph.children) &&
  paragraph.children.length === 1 &&
  paragraph.children[0].type === 'inlineCode'

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

const isInlineParagraph = (node) => {
  if (!node || node.type !== 'paragraph') {
    return false
  }
  if (!Array.isArray(node.children) || node.children.length === 0) {
    return true
  }
  return node.children.every((child) => INLINE_NODE_TYPES.has(child.type))
}

const getLastInlineChar = (children) => {
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const child = children[i]
    if (child.type === 'text' && child.value) {
      const trimmed = child.value.trimEnd()
      if (trimmed) {
        return trimmed[trimmed.length - 1]
      }
    }
    if (child.type === 'inlineCode' && child.value) {
      const trimmed = child.value.trimEnd()
      if (trimmed) {
        return trimmed[trimmed.length - 1]
      }
    }
  }
  return null
}

const getFirstInlineChar = (children) => {
  for (const child of children) {
    if (child.type === 'text' && child.value) {
      const trimmed = child.value.trimStart()
      if (trimmed) {
        return trimmed[0]
      }
    }
    if (child.type === 'inlineCode' && child.value) {
      const trimmed = child.value.trimStart()
      if (trimmed) {
        return trimmed[0]
      }
    }
  }
  return null
}

const NEVER_BEFORE_SPACE = new Set([',', '.', ';', ':', ')', ']', '}', '?'])
const NEVER_AFTER_SPACE = new Set(['(', '[', '{'])

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

const getLastParagraphFromItem = (listItem) => {
  if (!Array.isArray(listItem.children)) {
    return null
  }
  for (let i = listItem.children.length - 1; i >= 0; i -= 1) {
    const child = listItem.children[i]
    if (child.type === 'paragraph') {
      return child
    }
  }
  return null
}

const attachFragmentToListItem = (listItem, fragment) => {
  if (!listItem || !fragment) {
    return
  }
  const target = getLastParagraphFromItem(listItem) || (() => {
    const paragraph = cloneParagraph(fragment)
    listItem.children = Array.isArray(listItem.children) ? listItem.children : []
    listItem.children.push(paragraph)
    return paragraph
  })()

  if (target === fragment) {
    return
  }

  mergeParagraphs(target, fragment)
}

const tightenListItems = (tree) => {
  visit(tree, 'listItem', (listItem) => {
    if (!Array.isArray(listItem.children) || listItem.children.length <= 1) {
      return
    }

    const normalized = []
    let buffer = null

    for (const child of listItem.children) {
      if (isInlineParagraph(child)) {
        buffer = buffer ? mergeParagraphs(buffer, child) : cloneParagraph(child)
        continue
      }

      if (buffer) {
        normalized.push(buffer)
        buffer = null
      }

      if (child.children) {
        tightenListItems(child)
      }

      normalized.push(child)
    }

    if (buffer) {
      normalized.push(buffer)
    }

    listItem.children = normalized
  })
}

const reattachDanglingParagraphs = (parent) => {
  if (!parent || !Array.isArray(parent.children)) {
    return
  }

  let lastAttachableItem = null

  for (let index = 0; index < parent.children.length; ) {
    const child = parent.children[index]

    if (child.type === 'list') {
      if (Array.isArray(child.children) && child.children.length > 0) {
        lastAttachableItem = child.children[child.children.length - 1]
      } else {
        lastAttachableItem = null
      }
      reattachDanglingParagraphs(child)
      index += 1
      continue
    }

    if (child.type === 'listItem' || child.type === 'blockquote') {
      reattachDanglingParagraphs(child)
    }

    if (lastAttachableItem && isInlineParagraph(child)) {
      attachFragmentToListItem(lastAttachableItem, child)
      parent.children.splice(index, 1)
      continue
    }

    if (child.type !== 'paragraph') {
      lastAttachableItem = null
    }

    index += 1
  }
}

const shouldChainParagraph = (previousParagraph, currentParagraph) => {
  if (!previousParagraph) {
    return false
  }

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

  if (endsWithInlineCode(previousParagraph)) {
    return false
  }

  const currentText = getParagraphText(currentParagraph).trim()
  const previousText = getParagraphText(previousParagraph).trim()

  if (!currentText) {
    return true
  }

  if (isInlineCodeOnly(currentParagraph)) {
    return true
  }

  const firstChar = currentText[0]
  const startsWithConjunction = /^(und|oder|and|or)\b/i.test(currentText)
  const previousEndsSentence = /[.!?)]$/.test(previousText)

  if (/[,:;)\]]/.test(firstChar)) {
    return true
  }

  if (startsWithConjunction) {
    return true
  }

  if (/^[a-z\u00C0-\u024F]/.test(firstChar)) {
    return true
  }

  return !previousEndsSentence
}

const mergeLooseParagraphs = (parent) => {
  if (!parent || !Array.isArray(parent.children)) {
    return
  }

  const merged = []
  let activeParagraph = null

  for (const child of parent.children) {
    if (child.type === 'paragraph' && shouldChainParagraph(activeParagraph, child)) {
      mergeParagraphs(activeParagraph, child)
      continue
    }

    if (child.children) {
      mergeLooseParagraphs(child)
    }

    merged.push(child)
    activeParagraph = child.type === 'paragraph' ? child : null
  }

  parent.children = merged
}

/**
 * Remark plugin that stitches sequences of inline-only paragraphs back together so prose flows naturally.
 * It first tightens loose list items, reattaches dangling inline fragments, and finally merges paragraphs that
 * should be chained based on punctuation heuristics.
 *
 * @returns {(tree: import('mdast').Root) => void} Transformer that mutates the Markdown AST in-place.
 */
const remarkMergeInlineParagraphs = () => (tree) => {
  tightenListItems(tree)
  reattachDanglingParagraphs(tree)
  mergeLooseParagraphs(tree)
}

export default remarkMergeInlineParagraphs
