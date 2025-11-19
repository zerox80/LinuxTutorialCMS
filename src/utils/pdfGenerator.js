import html2pdf from 'html2pdf.js'

/**
 * Converts a color string to a safe format (Hex/RGB) if it uses unsupported formats like oklab/oklch.
 * @param {string} color - The color string to check.
 * @returns {string} - The sanitized color string.
 */
const sanitizeColor = (color) => {
    if (!color) return color
    // If it contains oklab or oklch, we need to convert or fallback.
    // Since we can't easily convert oklab to rgb in browser without a library or canvas hack,
    // and we are already in a context where we want to be fast, we will try a canvas approach
    // or a simple fallback if that fails.
    if (color.includes('oklab') || color.includes('oklch')) {
        // Create a temporary element to let the browser compute the RGB value
        // Browsers that support oklab (like Chrome) will compute it to rgb() when asked via getComputedStyle
        // BUT, we are reading this FROM getComputedStyle usually.
        // If the browser returns 'oklab(...)', it means it preserves it.
        // However, html2canvas (used by html2pdf) doesn't understand it.

        // Strategy: Use a canvas to force conversion to RGB?
        // Or just fallback to a safe color if we can't convert.
        // Actually, most modern browsers return 'oklab' if defined as such.

        // Let's try to use a temp div and force a style read in a way that might give us RGB?
        // No, usually getComputedStyle is the source of truth.

        // Fallback strategy:
        // If it's a background, white is safe.
        // If it's text, black is safe.
        // This is a "better than crash" approach.
        return '#000000' // Default fallback
    }
    return color
}

/**
 * Recursively copies styles from source to target, sanitizing colors.
 * @param {HTMLElement} source 
 * @param {HTMLElement} target 
 */
const copyStyles = (source, target) => {
    const computed = window.getComputedStyle(source)

    // We only care about visual properties that html2canvas needs
    // Copying ALL styles is slow and heavy.
    // But for accurate PDF, we need most of them.

    // List of properties to explicitly copy and sanitize
    const properties = [
        'color', 'backgroundColor', 'borderColor', 'borderWidth', 'borderStyle',
        'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
        'lineHeight', 'textAlign', 'textDecoration', 'textTransform',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
        'display', 'position', 'width', 'height', 'minWidth', 'minHeight',
        'maxWidth', 'maxHeight', 'opacity', 'visibility', 'zIndex',
        'boxShadow', 'borderRadius', 'overflow'
    ]

    for (const prop of properties) {
        let val = computed[prop]

        // Sanitize colors
        if (['color', 'backgroundColor', 'borderColor', 'outlineColor', 'textDecorationColor'].includes(prop)) {
            if (val && (val.includes('oklab') || val.includes('oklch'))) {
                // Simple heuristic fallback
                if (prop === 'backgroundColor') {
                    // Try to guess if it should be light or dark? Hard.
                    // Default to transparent or white
                    val = 'transparent'
                    if (source.tagName === 'BODY' || source.classList.contains('bg-white')) {
                        val = '#ffffff'
                    }
                } else {
                    val = '#000000' // Text/border usually dark
                    if (source.classList.contains('text-white')) {
                        val = '#ffffff'
                    }
                }
            }
        }

        target.style[prop] = val
    }

    // Handle children
    for (let i = 0; i < source.children.length; i++) {
        if (target.children[i]) {
            copyStyles(source.children[i], target.children[i])
        }
    }
}

/**
 * Generates a PDF from a React element (DOM node).
 * @param {HTMLElement} element - The DOM element to render.
 * @param {string} filename - The output filename.
 */
export const generatePdf = async (element, filename) => {
    if (!element) throw new Error('Element not found')

    // 1. Clone the element
    const clone = element.cloneNode(true)

    // 2. Create a container for isolation
    // We use a hidden container in the main document instead of iframe for simplicity first,
    // BUT the issue is global styles.
    // To truly isolate, we need to NOT have the Tailwind styles applied to the clone,
    // but instead apply the computed styles (sanitized) directly.

    // Create a temporary container off-screen
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = '800px' // Fixed width for A4 consistency
    document.body.appendChild(container)

    try {
        container.appendChild(clone)

        // 3. Apply computed styles from original to clone (Sanitized)
        // We need to do this BEFORE html2pdf runs
        // Note: copyStyles needs the clone to be in DOM to work best? 
        // Actually, we read from 'element' (original) which is in DOM.
        // We write to 'clone' which is in 'container' (in DOM).
        copyStyles(element, clone)

        // 4. Configure html2pdf
        const opt = {
            margin: [10, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        }

        // 5. Generate
        await html2pdf().set(opt).from(clone).save()

    } finally {
        // 6. Cleanup
        document.body.removeChild(container)
    }
}
