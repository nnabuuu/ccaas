const pptxgen = require('pptxgenjs');
const path = require('path');

// Use the html2pptx library from the skill
const html2pptx = require('/Users/niex/.claude/plugins/cache/anthropic-agent-skills/example-skills/f23222824449/skills/pptx/scripts/html2pptx');

async function createPresentation() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'CCAAS Team';
    pptx.title = '@kedge-agentic/vue-sdk';
    pptx.subject = 'Vue Composables for Claude-Code-as-a-Service';

    const slidesDir = __dirname;
    const slides = [
        'slide1.html',  // Title
        'slide2.html',  // Overview
        'slide3.html',  // Core Composables
        'slide4.html',  // useAIEditing Workflow
        'slide5.html',  // FormStateSynchronizer
        'slide6.html',  // Injection Symbols
        'slide7.html',  // Test Coverage
        'slide8.html',  // Build Output
        'slide9.html',  // Get Started
    ];

    for (const slideFile of slides) {
        const htmlPath = path.join(slidesDir, slideFile);
        console.log(`Processing ${slideFile}...`);
        await html2pptx(htmlPath, pptx);
    }

    const outputPath = path.join(slidesDir, '..', 'vue-agent-sdk-presentation.pptx');
    await pptx.writeFile({ fileName: outputPath });
    console.log(`Presentation created: ${outputPath}`);
}

createPresentation().catch(console.error);
