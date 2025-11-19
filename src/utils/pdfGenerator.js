import html2pdf from 'html2pdf.js'

/**
 * Copies computed styles from a source element to a target element.
 * This "bakes" the styles into the element so it looks correct even without stylesheets.
 */
const copyComputedStyles = (source, target) => {
    const computed = window.getComputedStyle(source);

    // We can't just copy cssText because it's often empty for computed styles.
    // We need to copy specific properties. This is a comprehensive list of visual properties.
    const properties = [
        // Layout
        'display', 'position', 'width', 'height', 'margin', 'padding', 'top', 'left', 'right', 'bottom',
        'float', 'clear', 'z-index', 'box-sizing', 'overflow',

        // Flex/Grid (important for layout)
        'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'gap',
        'grid-template-columns', 'grid-template-rows', 'grid-gap',

        // Typography
        'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
        'text-align', 'text-transform', 'text-decoration', 'letter-spacing', 'white-space', 'color',

        // Visuals
        'background-color', 'background-image', 'background-position', 'background-size', 'background-repeat',
        'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
        'border-radius', 'border-collapse', 'border-spacing',
        'box-shadow', 'opacity', 'visibility'
    ];

    properties.forEach(prop => {
        // We use getPropertyValue to get the resolved value (e.g. 'rgb(0, 0, 0)' instead of 'var(--color)')
        const value = computed.getPropertyValue(prop);
        if (value && value !== 'none' && value !== 'auto' && value !== 'normal') {
            target.style.setProperty(prop, value);
        }
    });

    // Explicitly handle background color if it's transparent, to ensure readability if parents change
    if (computed.backgroundColor === 'rgba(0, 0, 0, 0)' || computed.backgroundColor === 'transparent') {
        // Don't force white, just leave transparent
    } else {
        target.style.backgroundColor = computed.backgroundColor;
    }

    // Explicitly handle color to ensure it's RGB
    target.style.color = computed.color;
}

/**
 * Recursively copies styles from a source tree to a target tree.
 */
const cloneWithStyles = (source, target) => {
    copyComputedStyles(source, target);

    // Iterate children
    for (let i = 0; i < source.children.length; i++) {
        const sourceChild = source.children[i];
        const targetChild = target.children[i];
        if (sourceChild && targetChild) {
            cloneWithStyles(sourceChild, targetChild);
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

    // 1. Create a hidden iframe to isolate the PDF generation
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px'; // A4 width
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write('<html><head></head><body></body></html>');
        doc.close();

        // 2. Clone the element
        // We clone it into the main document first to ensure we can traverse it easily if needed, 
        // but actually we just clone the node.
        const clone = element.cloneNode(true);

        // 3. Copy computed styles from the original element to the clone
        // This is crucial: we are "baking" the styles into the inline style attributes
        // so that we don't need the external stylesheets (which contain the problematic oklch).
        cloneWithStyles(element, clone);

        // 4. Clean up the clone for print (overrides)
        const cleanElement = (el) => {
            // Remove shadows and borders that look bad in print
            // We can just overwrite the styles we just copied
            if (el.style.boxShadow) el.style.boxShadow = 'none';

            // Force white background for the main container
            if (el.tagName === 'ARTICLE') {
                el.style.backgroundColor = '#ffffff';
                el.style.color = '#000000';
                el.style.border = 'none';
            }

            // Recursively clean
            for (let i = 0; i < el.children.length; i++) {
                cleanElement(el.children[i]);
            }
        }
        cleanElement(clone);

        // 5. Append clone to iframe
        doc.body.appendChild(clone);

        // Add some basic reset styles to the iframe body
        doc.body.style.margin = '0';
        doc.body.style.padding = '20px';
        doc.body.style.backgroundColor = '#ffffff';
        doc.body.style.fontFamily = 'sans-serif';

        // 6. Configure html2pdf
        const opt = {
            margin: [10, 10, 10, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 800
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        }

        // 7. Generate PDF from the element INSIDE the iframe
        await html2pdf().set(opt).from(clone).save();

    } finally {
        // 8. Cleanup
        document.body.removeChild(iframe);
    }
}
