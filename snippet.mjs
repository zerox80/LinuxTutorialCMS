import React from 'react'
import ReactDOMServer from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkMergeInlineParagraphs from './src/utils/remarkMergeInlineParagraphs.js'

const content = `1. Reads the command line.
2. Splits it into words (the command \`ls\`, the option \`-l\`, and the argument \`/home\`).
3. Searches for the executable program (\`ls\`) in your system's directories.`

const html = ReactDOMServer.renderToStaticMarkup(
  React.createElement(ReactMarkdown, {
    children: content,
    remarkPlugins: [remarkMath, remarkGfm, remarkMergeInlineParagraphs],
  })
)

console.log(html)
