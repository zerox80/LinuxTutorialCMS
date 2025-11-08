import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import fs from 'fs'

const content = `2. Splits it into words (the command

\`ls\`

, the option

\`-l\`

, and the argument

\`/home\`

).`

const tree = unified().use(remarkParse).use(remarkMath).use(remarkGfm).parse(content)
console.log(JSON.stringify(tree, null, 2))
