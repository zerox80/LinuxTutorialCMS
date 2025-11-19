import html2pdf from 'html2pdf.js'

/**
 * Helper to convert any CSS color string to RGB format using the browser's native color parsing.
 * This handles oklch, oklab, hsl, etc. by letting the browser compute the rgb value.
 */
const convertColorToRgb = (colorString) => {
    if (!colorString || colorString === 'transparent' || colorString === 'inherit') return colorString;

    // Create a temporary element to compute the color
    const div = document.createElement('div');
    div.style.color = colorString;
    div.style.display = 'none';
    document.body.appendChild(div);

    const computedColor = window.getComputedStyle(div).color;
    document.body.removeChild(div);

    return computedColor;
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
    // We use a fixed-width container to simulate A4 paper width and ensure consistent rendering
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = '800px' // ~A4 width at 96dpi
    container.style.backgroundColor = '#ffffff'
    container.style.color = '#000000'
    container.style.fontFamily = 'Inter, sans-serif' // Ensure font consistency

    // Append to body to allow rendering
    document.body.appendChild(container)

    try {
        // 3. Clean the clone for print
        // Remove dark mode classes and other UI artifacts
        const cleanElement = (el) => {
            // Remove dark mode specific classes
            if (el.classList) {
                // Remove shadow and border classes that look bad in print
                el.classList.remove('shadow-xl', 'shadow-2xl', 'shadow-lg', 'shadow-md', 'shadow-sm')
                el.classList.remove('border', 'border-gray-200', 'border-slate-700', 'dark:border-slate-700')
                el.classList.remove('bg-slate-900', 'dark:bg-slate-900', 'bg-gradient-to-br')

                // Force white background and black text for main containers
                if (el.tagName === 'ARTICLE' || el.classList.contains('bg-white')) {
                    el.style.backgroundColor = '#ffffff'
                    el.style.color = '#000000'
                    el.style.boxShadow = 'none'
                    el.style.border = 'none'
                }

                // Fix text colors
                if (el.classList.contains('text-gray-300') || el.classList.contains('text-slate-300')) {
                    el.classList.remove('text-gray-300', 'text-slate-300')
                    el.classList.add('text-gray-700')
                }
                if (el.classList.contains('text-slate-100')) {
                    el.classList.remove('text-slate-100')
                    el.classList.add('text-black')
                }
            }

            // SANITIZE COLORS: Convert all computed colors to RGB to avoid 'oklch' errors
            const computedStyle = window.getComputedStyle(el);

            // We explicitly check and convert specific properties that might contain oklch
            const propertiesToCheck = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'];

            propertiesToCheck.forEach(prop => {
                const val = computedStyle[prop];
                if (val && (val.includes('oklch') || val.includes('oklab'))) {
                    // Convert to RGB
                    el.style[prop] = convertColorToRgb(val);
                }
            });

            // Recursively clean children
            for (let i = 0; i < el.children.length; i++) {
                cleanElement(el.children[i])
            }
        }

        // We need to append the clone to the container BEFORE cleaning/computing styles
        // because window.getComputedStyle requires the element to be in the DOM.
        container.appendChild(clone);

        // Now clean and sanitize colors
        cleanElement(clone)

        // Add padding to the clone itself to act as page margins inside the container
        clone.style.padding = '40px'
        clone.style.backgroundColor = '#ffffff'

        // 4. Configure html2pdf
        const opt = {
            margin: [10, 10, 10, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff', // Force white background
                windowWidth: 800 // Match container width
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
