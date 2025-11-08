import { visit } from 'unist-util-visit'

const LETTER_NUMBER_REGEX = /[A-Za-z0-9\u00C0-\u024F]/
const TERMINAL_PUNCTUATION_REGEX = /[.!?;:)]$/
const LEADING_PUNCTUATION_REGEX = /^[\],.;:)(-]/

const isPunctuationOnlyText = (value = '') => !LETTER_NUMBER_REGEX.test(value.replace(/\s+/g, ''))

const extractPlainText = (node) => {
  if (!node || !node.children) {
    return ''
  }
  let buffer = ''
  for (const child of node.children) {
    if (typeof child.value === 'string') {
      buffer += child.value
    } else if (child.children) {
      buffer += extractPlainText(child)
    }
  }
  return buffer
}

const getFirstMeaningfulChar = (children) => {
  for (const child of children) {
    if (child.type === 'text' && child.value) {
      const trimmed = child.value.trimStart()
      if (trimmed.length > 0) {
        return trimmed[0]
      }
    }
    if (child.type === 'inlineCode' && child.value) {
      return child.value.trimStart()[0]
    }
  }
  return null
}

const getLastMeaningfulChar = (children) => {
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const child = children[i]
    if (child.type === 'text' && child.value) {
      const trimmed = child.value.trimEnd()
      if (trimmed.length > 0) {
        return trimmed[trimmed.length - 1]
      }
    }
    if (child.type === 'inlineCode' && child.value) {
      const value = child.value.trimEnd()
      if (value.length > 0) {
        return value[value.length - 1]
      }
    }
  }
  return null
}

const needsSpaceBetween = (leftChildren, rightChildren) => {
  const leftChar = getLastMeaningfulChar(leftChildren)
  const rightChar = getFirstMeaningfulChar(rightChildren)
  if (!leftChar || !rightChar) {
    return false
  }
  return (
    LETTER_NUMBER_REGEX.test(leftChar) &&
    LETTER_NUMBER_REGEX.test(rightChar)
  )
}

const isInlineFragment = (node) => {
  if (!node || node.type !== 'paragraph') {
    return false
  }

  if (node.children.length === 0) {
    return true
  }

  return node.children.every((child) => {
    if (child.type === 'inlineCode') {
      return true
    }
    if (child.type === 'text') {
      return isPunctuationOnlyText(child.value)
    }
    return false
  })
}

const appendFragment = (target, fragment) => {
  if (!target || !fragment) {
    return
  }

  if (needsSpaceBetween(target.children, fragment.children)) {
    target.children.push({ type: 'text', value: ' ' })
  }

  target.children.push(...fragment.children)
}

const prependFragment = (target, fragment) => {
  if (!target || !fragment) {
    return
  }

  if (needsSpaceBetween(fragment.children, target.children)) {
    fragment.children.push({ type: 'text', value: ' ' })
  }

  target.children.unshift(...fragment.children)
}

const ensureChildren = (node) => {
  if (!node.children) {
    node.children = []
  }
  return node.children
}

const cloneParagraph = () => ({
  type: 'paragraph',
  children: [],
})

const findTailParagraph = (node, { createIfMissing = false } = {}) => {
  if (!node) return null

  if (node.type === 'paragraph') {
    return isInlineFragment(node) ? null : node
  }

  if (node.type === 'list') {
    const items = node.children || []
    const lastItem = items[items.length - 1]
    if (!lastItem && createIfMissing) {
      const newItem = { type: 'listItem', children: [cloneParagraph()] }
      ensureChildren(node).push(newItem)
      return newItem.children[0]
    }
    return findTailParagraph(lastItem, { createIfMissing })
  }

  if (node.type === 'listItem' || node.type === 'blockquote') {
    const children = node.children || []
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const candidate = findTailParagraph(children[i], { createIfMissing: false })
      if (candidate) {
        return candidate
      }
    }
    if (createIfMissing) {
      const paragraph = cloneParagraph()
      ensureChildren(node).push(paragraph)
      return paragraph
    }
  }

  return null
}

const findHeadParagraph = (node, { createIfMissing = false } = {}) => {
  if (!node) return null

  if (node.type === 'paragraph') {
    return isInlineFragment(node) ? null : node
  }

  if (node.type === 'list') {
    const items = node.children || []
    const firstItem = items[0]
    if (!firstItem && createIfMissing) {
      const newItem = { type: 'listItem', children: [cloneParagraph()] }
      ensureChildren(node).unshift(newItem)
      return newItem.children[0]
    }
    return findHeadParagraph(firstItem, { createIfMissing })
  }

  if (node.type === 'listItem' || node.type === 'blockquote') {
    const children = node.children || []
    for (let i = 0; i < children.length; i += 1) {
      const candidate = findHeadParagraph(children[i], { createIfMissing: false })
      if (candidate) {
        return candidate
      }
    }
    if (createIfMissing) {
      const paragraph = cloneParagraph()
      ensureChildren(node).unshift(paragraph)
      return paragraph
    }
  }

  return null
}

const shouldMergeParagraph = (previousParagraph, currentParagraph) => {
  if (!previousParagraph) {
    return false
  }

  const currentText = extractPlainText(currentParagraph).trim()
  if (!currentText) {
    return true
  }

  if (isInlineFragment(currentParagraph)) {
    return true
  }

  const startsWithLowercase = /^[a-z\u00C0-\u024F]/.test(currentText[0])
  const startsWithPunctuation = LEADING_PUNCTUATION_REGEX.test(currentText)
  const previousText = extractPlainText(previousParagraph).trim()
  const previousEndsSentence = TERMINAL_PUNCTUATION_REGEX.test(previousText)

  return startsWithPunctuation || startsWithLowercase || !previousEndsSentence
}

const remarkMergeInlineParagraphs = () => (tree) => {
  visit(tree, (node) => {
    if (!node || !Array.isArray(node.children)) {
      return
    }

    const mergedChildren = []
    let activeParagraph = null

    for (let index = 0; index < node.children.length; index += 1) {
      const current = node.children[index]

      if (current.type !== 'paragraph') {
        mergedChildren.push(current)
        activeParagraph = null
        continue
      }

      if (shouldMergeParagraph(activeParagraph, current)) {
        appendFragment(activeParagraph, current)
        continue
      }

      mergedChildren.push(current)
      activeParagraph = isInlineFragment(current) ? activeParagraph : current
    }

    node.children = mergedChildren

    for (let index = 0; index < node.children.length; index += 1) {
      const current = node.children[index]
      if (!isInlineFragment(current)) {
        continue
      }

      const previous = node.children[index - 1]
      const next = node.children[index + 1]

      const appendTarget =
        (previous && previous.type === 'paragraph' && !isInlineFragment(previous) && previous) ||
        findTailParagraph(previous, { createIfMissing: true })

      if (appendTarget) {
        appendFragment(appendTarget, current)
        node.children.splice(index, 1)
        index -= 1
        continue
      }

      const prependTarget =
        (next && next.type === 'paragraph' && !isInlineFragment(next) && next) ||
        findHeadParagraph(next, { createIfMissing: true })

      if (prependTarget) {
        prependFragment(prependTarget, current)
        node.children.splice(index, 1)
        index -= 1
      }
    }
  })
}

export default remarkMergeInlineParagraphs
