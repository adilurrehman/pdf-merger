// Merges PDFs entirely in memory: takes file Buffers, returns the merged PDF as a Buffer
const mergePDF = async (fileBuffers, pageRanges = null) => {
  const PDFMerger = (await import('pdf-merger-js')).default;
  const merger = new PDFMerger();

  // Add all PDF files to merge
  for (let i = 0; i < fileBuffers.length; i++) {
    const fileBuffer = fileBuffers[i];

    // Check if specific pages are requested
    if (pageRanges && pageRanges[i] && pageRanges[i].toLowerCase() !== 'all') {
      // Parse page range (e.g., "1-3, 5, 7-10")
      await merger.add(fileBuffer, pageRanges[i]);
    } else {
      // Add all pages
      await merger.add(fileBuffer);
    }
  }

  // Export the merged PDF (Buffer in Node, Uint8Array in the browser build) as a Buffer
  const merged = await merger.saveAsBuffer();
  return Buffer.from(merged.buffer, merged.byteOffset, merged.byteLength);
};

module.exports = { mergePDF };
