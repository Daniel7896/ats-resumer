// Client-side text extraction utilities for PDF and DOCX
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

// Set up PDF.js worker locally to prevent external CDN dependency failure
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/**
 * Extracts raw text from a PDF file using pdfjs-dist
 * @param file The File object uploaded by the user
 * @returns A promise resolving to the extracted text
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;
        
        let fullText = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          
          fullText += pageText + "\n";
        }
        
        const cleanedText = fullText.trim();
        // Check if there is practically no readable text layer
        if (cleanedText.replace(/\s+/g, "").length === 0) {
          throw new Error("This PDF appears to be a scanned image with no selectable text. Please upload a text-based PDF or a DOCX file instead.");
        }
        
        resolve(cleanedText);
      } catch (error: any) {
        console.error("PDF extraction error full details:", error);
        if (error && error.stack) {
          console.error("PDF extraction error stack trace:", error.stack);
        }
        
        if (error && error.name === "PasswordException") {
          reject(new Error("This PDF is password-protected. Please remove the password and try again."));
        } else if (error && error.message && error.message.includes("scanned image")) {
          reject(error);
        } else {
          reject(new Error("Failed to parse PDF. The file might be password-protected or corrupted."));
        }
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file buffer."));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extracts raw text from a DOCX file using mammoth
 * @param file The File object uploaded by the user
 * @returns A promise resolving to the extracted text
 */
export async function extractTextFromDocx(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        resolve(result.value.trim());
      } catch (error) {
        console.error("DOCX extraction error:", error);
        reject(new Error("Failed to parse DOCX. Ensure it is a valid Microsoft Word file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file buffer."));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Common helper to detect type and extract text
 * @param file User uploaded file
 */
export async function extractText(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  
  if (extension === "pdf") {
    return extractTextFromPdf(file);
  } else if (extension === "docx") {
    return extractTextFromDocx(file);
  } else if (extension === "txt") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.onerror = () => reject(new Error("Failed to read text file."));
      reader.readAsText(file);
    });
  } else {
    throw new Error("Unsupported file type. Only PDF and DOCX files are supported.");
  }
}
