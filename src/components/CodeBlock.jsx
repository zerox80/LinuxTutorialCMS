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
    const code = children?.props?.children || children;
    const textToCopy = typeof code === 'string' ? code : String(code);
    
    try {
      await navigator.clipboard.writeText(textToCopy.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
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
