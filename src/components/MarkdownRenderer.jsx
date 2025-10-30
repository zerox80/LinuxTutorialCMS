import PropTypes from 'prop-types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'

const mergeClassNames = (...classes) => classes.filter(Boolean).join(' ')

const headingClasses = {
  1: 'text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-10 first:mt-0',
  2: 'text-2xl sm:text-3xl font-semibold text-gray-900 mt-8 first:mt-0',
  3: 'text-xl sm:text-2xl font-semibold text-gray-900 mt-6 first:mt-0',
  4: 'text-lg font-semibold text-gray-900 mt-5 first:mt-0',
  5: 'text-base font-semibold text-gray-800 mt-4 first:mt-0 uppercase tracking-wide',
  6: 'text-sm font-semibold text-gray-700 mt-4 first:mt-0 uppercase tracking-wider',
}

const MarkdownRenderer = ({ content, className = '', withBreaks = false }) => {
  const remarkPlugins = withBreaks ? [remarkGfm, remarkBreaks] : [remarkGfm]

  return (
    <div className={mergeClassNames('markdown-renderer text-gray-700', className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[rehypeHighlight]}
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
            <p className="mt-5 first:mt-0 text-base sm:text-lg leading-8 text-gray-700" {...props}>
              {children}
            </p>
          ),
          ul: ({ node, children, ...props }) => (
            <ul className="mt-5 first:mt-0 list-disc list-outside space-y-3 pl-6 text-base sm:text-lg leading-8 text-gray-700" {...props}>
              {children}
            </ul>
          ),
          ol: ({ node, children, ...props }) => (
            <ol className="mt-5 first:mt-0 list-decimal list-outside space-y-3 pl-6 text-base sm:text-lg leading-8 text-gray-700" {...props}>
              {children}
            </ol>
          ),
          li: ({ node, children, ...props }) => (
            <li className="leading-7 text-gray-700 marker:text-primary-600" {...props}>
              {children}
            </li>
          ),
          blockquote: ({ node, children, ...props }) => (
            <blockquote
              className="mt-6 first:mt-0 rounded-2xl border-l-4 border-primary-400/80 bg-primary-50/60 px-5 py-4 text-base sm:text-lg italic text-gray-700"
              {...props}
            >
              {children}
            </blockquote>
          ),
          a: ({ node, href, children, ...props }) => (
            <a
              href={href}
              className="font-semibold text-primary-700 underline underline-offset-4 transition-colors hover:text-primary-800"
              target={href?.startsWith('#') ? undefined : '_blank'}
              rel={href?.startsWith('#') ? undefined : 'noopener noreferrer'}
              {...props}
            >
              {children}
            </a>
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-10 border-t border-gray-200" {...props} />
          ),
          table: ({ node, children, ...props }) => (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ node, children, ...props }) => (
            <thead className="bg-gray-50" {...props}>
              {children}
            </thead>
          ),
          tbody: ({ node, children, ...props }) => (
            <tbody className="divide-y divide-gray-100" {...props}>
              {children}
            </tbody>
          ),
          th: ({ node, children, ...props }) => (
            <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-600" {...props}>
              {children}
            </th>
          ),
          td: ({ node, children, ...props }) => (
            <td className="px-4 py-3 text-sm text-gray-700" {...props}>
              {children}
            </td>
          ),
          code: ({ inline, className, children, ...props }) => {
            const childArray = Array.isArray(children) ? children : [children]
            const allText = childArray.every((child) => typeof child === 'string')
            const text = allText ? childArray.join('') : null
            const mathMatch = inline && text ? text.match(/^\$(.+)\$/) : null

            if (inline) {
              return (
                <code
                  className={mergeClassNames(
                    className,
                    'rounded-md bg-gray-100 py-0.5 font-mono text-sm text-primary-700'
                  )}
                  {...props}
                >
                  {mathMatch ? (
                    <span className="inline-math">{mathMatch[1].trim()}</span>
                  ) : (
                    text ?? children
                  )}
                </code>
              )
            }

            return (
              <code
                className={mergeClassNames(className, 'block font-mono text-sm leading-relaxed')}
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ className, children, ...props }) => (
            <pre
              className={mergeClassNames(
                className,
                'mt-6 overflow-x-auto rounded-2xl bg-gray-900 p-5 text-sm text-gray-100 shadow-inner'
              )}
              {...props}
            >
              {children}
            </pre>
          ),
          img: ({ node, alt, src, ...props }) => (
            <img
              src={src}
              alt={alt || ''}
              className="mt-6 w-full rounded-2xl border border-gray-200 object-contain"
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
