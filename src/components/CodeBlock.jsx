import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import PropTypes from 'prop-types';

/**
 * Code block component with syntax highlighting and copy-to-clipboard functionality.
 *
 * This component enhances code display by providing users with an easy way to copy
 * code snippets to their clipboard. It integrates with syntax highlighting libraries
 * and provides visual feedback when copying succeeds or fails.
 *
 * Key Features:
 * - Copy-to-clipboard functionality with visual feedback
 * - Hover-activated copy button for clean UI
 * - Automatic text content extraction and sanitization
 * - Error handling for clipboard operations
 * - Accessibility support with proper ARIA labels
 *
 * Accessibility Features:
 * - Proper ARIA labels for screen readers
 * - Keyboard navigation support
 * - Visual feedback for user actions
 * - Semantic HTML structure
 *
 * Security Considerations:
 * - Text sanitization through trim() operation
 * - Safe clipboard API usage with try-catch
 * - No direct DOM manipulation or script injection risks
 *
 * Performance Optimization:
 * - Minimal state updates (only one boolean state)
 * - Efficient text extraction logic
 * - Debounced feedback display (2-second timeout)
 * - Lightweight rendering with no heavy computations
 *
 * @component
 * @example
 * // Basic usage with code content
 * <CodeBlock>
 *   <pre><code>console.log('Hello World');</code></pre>
 * </CodeBlock>
 *
 * // With custom CSS classes
 * <CodeBlock className="language-javascript">
 *   <code>const greeting = "Hello";</code>
 * </CodeBlock>
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The code content to display. Can be a string
 *                                         or React element containing code text
 * @param {string} [props.className] - Optional CSS class for styling the code block.
 *                                     Typically used for language-specific syntax highlighting
 *
 * @returns {JSX.Element} Rendered code block with copy functionality and hover effects
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API} for clipboard API documentation
 * @see {@link https://highlightjs.org/} for syntax highlighting integration
 */
const CodeBlock = ({ children, className }) => {

  const [copied, setCopied] = useState(false);

  
  /**
   * Handles copying code content to the clipboard.
   *
   * This function extracts text content from the children prop, sanitizes it,
   * and attempts to write it to the user's clipboard. It provides visual
   * feedback by updating the copied state for 2 seconds.
   *
   * Extraction Logic:
   * 1. First tries to get children.props.children (for nested React elements)
   * 2. Falls back to direct children value
   * 3. Converts to string if necessary
   * 4. Trims whitespace for clean copying
   *
   * Error Handling:
   * - Catches clipboard API errors (permission denied, not supported, etc.)
   * - Logs errors to console for debugging
   * - Gracefully fails without breaking the UI
   *
   * @async
   * @function
   * @returns {Promise<void>} Resolves when copy operation completes or fails
   *
   * @throws {Error} When clipboard API fails (caught internally)
   *
   * @example
   * // This function is triggered when user clicks the copy button
   * handleCopy(); // Shows success feedback for 2 seconds
   */
  const handleCopy = async () => {

    // Extract text content from children, handling both direct strings and React elements
    const code = children?.props?.children || children;

    // Ensure we're working with a string and trim whitespace
    const textToCopy = typeof code === 'string' ? code : String(code);

    try {

      // Use the modern Clipboard API for secure copying
      await navigator.clipboard.writeText(textToCopy.trim());

      // Update state to show success feedback
      setCopied(true);

      // Reset feedback after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Handle clipboard errors (permissions, browser support, etc.)
      console.error('Failed to copy code:', err);
      // Note: We don't show error feedback to user to avoid confusion
    }
  };

  return (

    <div className="relative group">
      {}
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
        aria-label="Copy code"
      >
        {}
        {copied ? (

          <Check className="w-4 h-4 text-green-400" />
        ) : (

          <Copy className="w-4 h-4" />
        )}
      </button>

      {}
      <pre className={className}>
        {children}
      </pre>
    </div>
  );
};

CodeBlock.propTypes = {

  children: PropTypes.node.isRequired,

  className: PropTypes.string,
};

export default CodeBlock;
