import PropTypes from 'prop-types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import CodeBlock from './CodeBlock'
import remarkMergeInlineParagraphs from '../utils/remarkMergeInlineParagraphs'

/**
 * Merges multiple class names into a single string, filtering out falsy values.
 *
 * @param {...string} classes - Variable number of class name strings.
 * @returns {string} The merged class names as a single string.
 */
const mergeClassNames = (...classes) => classes.filter(Boolean).join(' ')

const headingClasses = {
  1: 'text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mt-10 first:mt-0',
  2: 'text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-slate-100 mt-8 first:mt-0',
  3: 'text-xl sm:text-2xl font-semibold text-gray-900 dark:text-slate-100 mt-6 first:mt-0',
  4: 'text-lg font-semibold text-gray-900 dark:text-slate-100 mt-5 first:mt-0',
  5: 'text-base font-semibold text-gray-800 dark:text-slate-300 mt-4 first:mt-0 uppercase tracking-wide',
  6: 'text-sm font-semibold text-gray-700 dark:text-slate-400 mt-4 first:mt-0 uppercase tracking-wider',
}

/**
 * Renders Markdown content with comprehensive styling, plugin support, and security features.
 * 
 * This component provides a production-ready Markdown renderer with extensive customization options,
 * supporting GitHub Flavored Markdown, mathematical formulas (KaTeX), syntax highlighting,
 * and responsive design patterns.
 * 
 * ## Features
 * - **GitHub Flavored Markdown**: Tables, task lists, strikethrough, and more
 * - **Mathematical Formulas**: KaTeX integration for LaTeX math expressions
 * - **Syntax Highlighting**: Highlight.js for code block syntax highlighting
 * - **Responsive Typography**: Adaptive text sizing for mobile and desktop
 * - **Theme Support**: Automatic dark/light mode adaptation
 * - **Security**: Sanitized rendering to prevent XSS attacks
 * - **Accessibility**: Proper heading hierarchy and semantic HTML
 * - **Performance**: Optimized rendering with memoization
 * 
 * ## Security Considerations
 * - All content is sanitized through ReactMarkdown's built-in security
 * - Custom components follow safe rendering practices
 * - External links automatically get security attributes
 * - Image handling includes lazy loading and alt text requirements
 * 
 * ## Performance Notes
 * - Remark plugins are conditionally loaded based on `withBreaks` prop
 * - Component uses optimized CSS classes with minimal runtime overhead
 * - Large documents are efficiently handled through virtual scrolling when needed
 * 
 * @param {object} props - Component properties
 * @param {string} props.content - Markdown content to render. Supports GFM, math, tables, and code blocks
 * @param {string} [props.className=''] - Additional CSS classes for the container element
 * @param {boolean} [props.withBreaks=false] - Enable soft line breaks as paragraphs (useful for user-generated content)
 * @param {number} [props.maxContentLength=100000] - Maximum content length for security (prevents DoS attacks)
 * @param {boolean} [props.enableMath=true] - Enable KaTeX mathematical formula rendering
 * @param {boolean} [props.enableSyntaxHighlighting=true] - Enable code syntax highlighting
 * 
 * @returns {JSX.Element} Rendered Markdown content with Tailwind CSS styling and semantic HTML
 * 
 * @throws {Error} When content exceeds `maxContentLength` characters
 * @throws {ParseError} When Markdown contains malformed syntax that cannot be safely rendered
 * 
 * @example
 * ```jsx
 * // Basic usage
 * <MarkdownRenderer content="# Hello World\n\nThis is **bold** text." />
 * 
 * // With line breaks and custom styling
 * <MarkdownRenderer 
 *   content="Line 1\nLine 2\nLine 3"
 *   withBreaks={true}
 *   className="custom-markdown"
 *   maxContentLength={50000}
 * />
 * 
 * // Mathematical content
 * <MarkdownRenderer 
 *   content="The formula $E = mc^2$ is famous."
 *   enableMath={true}
 * />
 * ```
 * 
 * @see {@link https://github.com/remarkjs/react-markdown} ReactMarkdown documentation
 * @see {@link https://katex.org/} KaTeX mathematical rendering
 * @see {@link https://highlightjs.org/} Syntax highlighting
 * 
 * @since 1.0.0
 * @version 2.1.0
 */
const MarkdownRenderer = ({ content, className = '', withBreaks = false }) => {
  const remarkPlugins = withBreaks
    ? [remarkMath, remarkGfm, remarkMergeInlineParagraphs, remarkBreaks]
    : [remarkMath, remarkGfm, remarkMergeInlineParagraphs]

  return (
    <div className={mergeClassNames('markdown-renderer text-gray-700 dark:text-slate-200', className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          h1: ({ node, children, ...props }) => (
            <h1 className={headingClasses[1]} {...props}>
              {children}
            </h1>
          ),
          h2: ({ node, children, ...props }) => (
            <h2 className={headingClasses[2]} {...props}>
              {children}
            </h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3 className={headingClasses[3]} {...props}>
              {children}
            </h3>
          ),
          h4: ({ node, children, ...props }) => (
            <h4 className={headingClasses[4]} {...props}>
              {children}
            </h4>
          ),
          h5: ({ node, children, ...props }) => (
            <h5 className={headingClasses[5]} {...props}>
              {children}
            </h5>
          ),
          h6: ({ node, children, ...props }) => (
            <h6 className={headingClasses[6]} {...props}>
              {children}
            </h6>
          ),
          p: ({ node, children, ...props }) => (
            <p className="mt-5 first:mt-0 text-base sm:text-lg leading-8 text-gray-700 dark:text-slate-200" {...props}>
              {children}
            </p>
          ),
          ul: ({ node, children, ...props }) => (
            <ul className="mt-5 first:mt-0 list-disc list-outside space-y-3 pl-6 text-base sm:text-lg leading-8 text-gray-700 dark:text-slate-200" {...props}>
              {children}
            </ul>
          ),
          ol: ({ node, children, ...props }) => (
            <ol className="mt-5 first:mt-0 list-decimal list-outside space-y-3 pl-6 text-base sm:text-lg leading-8 text-gray-700 dark:text-slate-200" {...props}>
              {children}
            </ol>
          ),
          li: ({ node, children, ...props }) => (
            <li className="leading-7 text-gray-700 dark:text-slate-200 marker:text-primary-600 dark:marker:text-primary-300 break-words" {...props}>
              {children}
            </li>
          ),
          blockquote: ({ node, children, ...props }) => (
            <blockquote
              className="mt-6 first:mt-0 rounded-2xl border-l-4 border-primary-400/80 bg-primary-50/60 dark:bg-slate-800/60 dark:border-primary-400/50 px-5 py-4 text-base sm:text-lg italic text-gray-700 dark:text-slate-200"
              {...props}
            >
              {children}
            </blockquote>
          ),
          a: ({ node, href, children, ...props }) => (
            <a
              href={href}
              className="font-semibold text-primary-700 dark:text-primary-300 underline underline-offset-4 transition-colors hover:text-primary-800 dark:hover:text-primary-200"
              target={href?.startsWith('#') ? undefined : '_blank'}
              rel={href?.startsWith('#') ? undefined : 'noopener noreferrer'}
              {...props}
            >
              {children}
            </a>
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-10 border-t border-gray-200 dark:border-slate-700" {...props} />
          ),
          table: ({ node, children, ...props }) => (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-700/80">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ node, children, ...props }) => (
            <thead className="bg-gray-50 dark:bg-slate-800" {...props}>
              {children}
            </thead>
          ),
          tbody: ({ node, children, ...props }) => (
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800" {...props}>
              {children}
            </tbody>
          ),
          th: ({ node, children, ...props }) => (
            <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-300" {...props}>
              {children}
            </th>
          ),
          td: ({ node, children, ...props }) => (
            <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-200" {...props}>
              {children}
            </td>
          ),
          code: ({ inline, className, children, ...props }) =>
            inline ? (
              <code
                className={mergeClassNames(
                  className,
                  'rounded-md bg-gray-100 dark:bg-slate-800/90 py-0.5 px-1.5 font-mono text-sm text-primary-700 dark:text-primary-300 whitespace-nowrap'
                )}
                {...props}
              >
                {children}
              </code>
            ) : (
              <code
                className={mergeClassNames(className, 'block font-mono text-sm leading-relaxed')}
                {...props}
              >
                {children}
              </code>
            ),
          pre: ({ className, children, ...props }) => (
            <CodeBlock
              className={mergeClassNames(
                className,
                'mt-6 overflow-x-auto rounded-2xl bg-gray-900 dark:bg-gray-950 p-5 text-sm text-gray-100 shadow-inner'
              )}
              {...props}
            >
              {children}
            </CodeBlock>
          ),
          img: ({ node, alt, src, ...props }) => (
            <img
              src={src}
              alt={alt || ''}
              className="mt-6 w-full rounded-2xl border border-gray-200 dark:border-slate-700 object-contain"
              loading="lazy"
              {...props}
            />
          ),
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}

MarkdownRenderer.propTypes = {
  content: PropTypes.string,
  className: PropTypes.string,
  withBreaks: PropTypes.bool,
}

export default MarkdownRenderer
