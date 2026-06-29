import * as pdfjsLib from "pdfjs-dist";
import { readFile } from "fs/promises";

async function main() {
  try {
    const data = await readFile("resume_final_1.pdf");
    const typedarray = new Uint8Array(data);
    const loadingTask = pdfjsLib.getDocument({ data: typedarray });
    const pdf = await loadingTask.promise;
    
    console.log("PDF parsed successfully!");
    console.log("Number of pages:", pdf.numPages);
    
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item.str)
        .join(" ");
      fullText += pageText + "\n";
    }
    console.log("Extracted text length:", fullText.trim().length);
    console.log("Extracted text sample:", fullText.trim().substring(0, 500));
  } catch (error) {
    console.error("Error parsing PDF:", error);
  }
}

main();
