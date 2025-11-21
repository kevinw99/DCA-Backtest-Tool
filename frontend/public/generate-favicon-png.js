// Simple script to create a data URL for favicon.png
// Since we don't have image processing libraries, we'll use the SVG directly
// Modern browsers support SVG favicons natively

const fs = require('fs');
const path = require('path');

const svgContent = fs.readFileSync(path.join(__dirname, 'favicon.svg'), 'utf8');
const base64 = Buffer.from(svgContent).toString('base64');
const dataUrl = `data:image/svg+xml;base64,${base64}`;

console.log('SVG favicon created successfully!');
console.log('Browsers will use the SVG directly via <link rel="icon" type="image/svg+xml">');
console.log('\nFor legacy browser support, you can use online converters:');
console.log('- https://realfavicongenerator.net/');
console.log('- https://favicon.io/');
console.log('\nData URL (for testing):');
console.log(dataUrl.substring(0, 100) + '...');
