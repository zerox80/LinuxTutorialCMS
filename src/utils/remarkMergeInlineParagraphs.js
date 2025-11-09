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
const remarkMergeInlineParagraphs = () => (tree) => {
  // Apply all transformation steps
  tightenListItems(tree)
  reattachDanglingParagraphs(tree)
  mergeLooseParagraphs(tree)
}
export default remarkMergeInlineParagraphs