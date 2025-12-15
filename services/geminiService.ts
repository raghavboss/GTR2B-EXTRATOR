import { GoogleGenAI } from "@google/genai";
import { InvoiceRow, ExtractionResult } from "../types";
import { generateMarkdownTable } from "../utils/excelParser";

const SYSTEM_INSTRUCTION = `You are an expert financial analyst specializing in GST (Goods and Services Tax) in India. 
Your task is to analyze GSTR-2B invoice data provided by the user.
Answer queries concisely and accurately based ONLY on the provided data.
If the answer requires calculation, perform it carefully.
Format currency values in standard Indian numbering (e.g., ₹1,50,000) if applicable.
Do not hallucinate data. If the information is not present in the dataset, say so.`;

export class GeminiService {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash';

  constructor() {
    const apiKey = process.env.API_KEY || '';
    if (!apiKey) {
      console.warn("API_KEY is missing from environment variables.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyzeData(data: InvoiceRow[], query: string): Promise<string> {
    try {
      // Truncate data if it's too huge to prevent context window overflow (simplistic approach)
      const dataString = JSON.stringify(data.slice(0, 1000)); 
      
      const prompt = `
Context: The user has uploaded a GSTR-2B Excel file containing B2B invoice details.
Data (JSON format, first 1000 rows):
\`\`\`json
${dataString}
\`\`\`

User Query: ${query}
`;

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingBudget: 0 } 
        }
      });

      return response.text || "I couldn't generate a response based on the data.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw new Error("Failed to analyze data with Gemini.");
    }
  }

  async extractFromPdf(base64Data: string, fileName: string): Promise<ExtractionResult> {
     try {
         const prompt = `Extract all tabular data from this Sale Register PDF document. 
Return the output as a clean JSON array of objects. 
Keys should match the column headers found in the document exactly (e.g., 'Invoice No', 'Date', 'Party Name', 'GSTIN', 'Total Amount', 'Taxable Value', 'IGST', 'CGST', 'SGST').
Ensure all numbers are parsed as numbers and dates as strings. 
Do not create nested objects, keep the structure flat.
If there are multiple tables, merge them into one array if they share the same structure.`;

         const response = await this.ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents: {
                 parts: [
                     { inlineData: { mimeType: 'application/pdf', data: base64Data } },
                     { text: prompt }
                 ]
             },
             config: {
                 responseMimeType: 'application/json'
             }
         });

         const text = response.text || "[]";
         let data: InvoiceRow[] = [];
         try {
             data = JSON.parse(text);
         } catch (e) {
             console.error("Failed to parse JSON from Gemini", e);
             throw new Error("Failed to parse PDF data. The model did not return valid JSON.");
         }

         if (!Array.isArray(data)) {
             data = [data]; // Handle case where it returns a single object
         }

         // Extract headers from the first few rows to ensure coverage
         const headerSet = new Set<string>();
         // Add 'S.No.' first
         headerSet.add('S.No.');
         
         data.forEach((row, index) => {
             // Inject S.No.
             row['S.No.'] = index + 1;
             Object.keys(row).forEach(k => headerSet.add(k));
         });

         const headers = Array.from(headerSet);
         const markdown = generateMarkdownTable(headers, data);

         return {
             headers,
             data,
             markdown,
             fileName
         };

     } catch (error) {
         console.error("Gemini PDF Extraction Error:", error);
         throw new Error("Failed to extract data from PDF. Please ensure it is a valid document.");
     }
  }
}

export const geminiService = new GeminiService();
