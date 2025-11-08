import React from 'react'
import ReactDOMServer from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkMergeInlineParagraphs from './src/utils/remarkMergeInlineParagraphs.js'

const content = `This takes the output of

\`ls\`

and uses it as input for

\`grep\`

, which filters lines containing "report".`

const html = ReactDOMServer.renderToStaticMarkup(
  React.createElement(ReactMarkdown, {
    children: content,
    remarkPlugins: [remarkMath, remarkGfm, remarkMergeInlineParagraphs],
  })
)

console.log(html)
