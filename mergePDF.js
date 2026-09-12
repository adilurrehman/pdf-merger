// Merges PDFs entirely in memory: takes file Buffers, returns the merged PDF as a Buffer.
// pageRanges is null or, per file, 'all' or an array of page numbers already validated by the caller.
const mergePDF = async (fileBuffers, pageRanges = null) => {
  const PDFMerger = (await import('pdf-merger-js')).default;
  const merger = new PDFMerger();

  // Add all PDF files to merge
  for (let i = 0; i < fileBuffers.length; i++) {
    const fileBuffer = fileBuffers[i];

    // Check if specific pages are requested
    if (pageRanges && Array.isArray(pageRanges[i])) {
      // Add only the selected pages (e.g., [1, 2, 3, 5])
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
