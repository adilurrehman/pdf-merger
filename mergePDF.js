const mergePDF = async (filePaths, pageRanges = null) => {
  const PDFMerger = (await import('pdf-merger-js')).default;
  const merger = new PDFMerger();

  // Add all PDF files to merge
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    
    // Check if specific pages are requested
    if (pageRanges && pageRanges[i] && pageRanges[i].toLowerCase() !== 'all') {
      // Parse page range (e.g., "1-3, 5, 7-10")
      await merger.add(filePath, pageRanges[i]);
    } else {
      // Add all pages
      await merger.add(filePath);
    }
  }

  let d = new Date().getTime()
  await merger.save(`public/${d}_merged.pdf`); //save under given name and reset the internal document
  return d
  // Export the merged PDF as a nodejs Buffer
  // const mergedPdfBuffer = await merger.saveAsBuffer();
  // fs.writeSync('merged.pdf', mergedPdfBuffer);
};

module.exports = { mergePDF };