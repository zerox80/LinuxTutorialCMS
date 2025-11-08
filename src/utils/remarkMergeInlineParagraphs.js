import { visit } from 'unist-util-visit'

const LETTER_NUMBER_REGEX = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]/

const isPunctuationOnlyText = (value = '') => !LETTER_NUMBER_REGEX.test(value.replace(/\s+/g, ''))

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

const remarkMergeInlineParagraphs = () => (tree) => {
  visit(tree, (node) => {
    if (!node || !Array.isArray(node.children)) {
      return
    }

    for (let index = 0; index < node.children.length; index += 1) {
      const current = node.children[index]
      if (!isInlineFragment(current)) {
        continue
      }

      const previous = node.children[index - 1]
      const next = node.children[index + 1]

      if (previous && previous.type === 'paragraph' && !isInlineFragment(previous)) {
        appendFragment(previous, current)
        node.children.splice(index, 1)
        index -= 1
        continue
      }

      if (next && next.type === 'paragraph' && !isInlineFragment(next)) {
        prependFragment(next, current)
        node.children.splice(index, 1)
        index -= 1
      }
    }
  })
}

export default remarkMergeInlineParagraphs
