import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import PropTypes from 'prop-types';

/**
 * Renders a preformatted code block with a copy button.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The code content to be displayed.
 * @param {string} [props.className] - Optional CSS class for styling the <pre> element.
 * @returns {JSX.Element} The rendered code block component.
 */
const CodeBlock = ({ children, className }) => {
  // State to track copy status for visual feedback
  const [copied, setCopied] = useState(false);

  /**
   * Copies the code content to the user's clipboard.
   *
   * Extracts text content from the children prop, trims whitespace,
   * and attempts to write it to the clipboard using the Clipboard API.
   * Shows visual feedback for 2 seconds after successful copy.
   *
   * @returns {Promise<void>} A promise that resolves when the copy operation completes or rejects on error.
   */
  const handleCopy = async () => {
    // Extract the actual code text from nested children (common with syntax highlighters)
    const code = children?.props?.children || children;
    // Ensure we're working with a string for the clipboard API
    const textToCopy = typeof code === 'string' ? code : String(code);

    try {
      // Use modern Clipboard API to write text to clipboard
      await navigator.clipboard.writeText(textToCopy.trim());
      // Show success feedback
      setCopied(true);
      // Reset copied state after 2 seconds for future copies
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    // Container div enables hover effects and provides positioning context
    <div className="relative group">
      {/* Copy button positioned absolutely in top-right corner */}
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
        aria-label="Copy code"
      >
        {/* Conditional icon rendering based on copy status */}
        {copied ? (
          // Success state - green checkmark
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          // Default state - copy icon
          <Copy className="w-4 h-4" />
        )}
      </button>

      {/* Pre element wraps the code content with syntax highlighting */}
      <pre className={className}>
        {children}
      </pre>
    </div>
  );
};

// Prop type validation for development-time error checking
CodeBlock.propTypes = {
  // children is required as it contains the code content to display
  children: PropTypes.node.isRequired,
  // className is optional - used for syntax highlighting libraries like Prism.js
  className: PropTypes.string,
};

export default CodeBlock;
