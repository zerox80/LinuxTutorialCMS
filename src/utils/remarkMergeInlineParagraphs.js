

const tightenListItems = () => { }
const reattachDanglingParagraphs = () => { }
const mergeLooseParagraphs = () => { }


const remarkMergeInlineParagraphs = () => (tree) => {
  // Apply all transformation steps
  tightenListItems(tree)
  reattachDanglingParagraphs(tree)
  mergeLooseParagraphs(tree)
}
export default remarkMergeInlineParagraphs