import * as XLSX from 'xlsx';
import { ExtractionResult, InvoiceRow } from '../types';

export const parseGstr2bExcel = async (file: File): Promise<ExtractionResult[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const targetSheets = ['B2B', 'B2B-CDNR', 'B2BA'];
        const results: ExtractionResult[] = [];

        // Identify available sheets based on partial match
        const availableSheets = workbook.SheetNames;
        
        targetSheets.forEach(target => {
            // Find sheet that contains the target name (case insensitive)
            const sheetName = availableSheets.find(name => 
                name.toUpperCase().includes(target.toUpperCase())
            );

            if (sheetName) {
                const sheetResult = parseSheet(workbook, sheetName, target);
                if (sheetResult) {
                    results.push(sheetResult);
                }
            }
        });

        if (results.length === 0) {
          reject(new Error('Could not find any relevant sheets (B2B, B2B-CDNR, B2BA). Please check the file format.'));
          return;
        }

        resolve(results);

      } catch (error) {
        console.error("Excel Parsing Error:", error);
        reject(new Error('Failed to parse the Excel file. Ensure it is a valid GSTR-2B file.'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsArrayBuffer(file);
  });
};

const parseSheet = (workbook: XLSX.WorkBook, sheetName: string, type: string): ExtractionResult | null => {
    try {
        const sheet = workbook.Sheets[sheetName];
        
        // 2. Convert to JSON (array of arrays) to find headers
        // using raw: false to get formatted strings (dates as DD-MM-YYYY if formatted in Excel)
        const jsonData = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, { header: 1, defval: '' });

        if (!jsonData || jsonData.length === 0) {
          return null;
        }

        // 3. Identify header row
        // Look for a row that contains "GSTIN of Supplier" or "Invoice number" or specific keys for CDNR
        let headerRowIndex = -1;
        
        // Extended keywords for detection including CDNR specific fields
        const detectionKeywords = ['gstin of supplier', 'invoice number', 'note/refund voucher number', 'note number'];
        
        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i] as string[];
          if (row.some((cell) => typeof cell === 'string' && detectionKeywords.some(kw => cell.toLowerCase().includes(kw)))) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          // Skip this sheet if headers not found
          return null;
        }

        // Merge the identified header row with the row immediately below it (common GSTR format)
        const row1 = (jsonData[headerRowIndex] || []) as Array<string | number>;
        const row2 = (jsonData[headerRowIndex + 1] || []) as Array<string | number>;

        // Determine the number of columns based on the widest row
        const colCount = Math.max(row1.length, row2.length);

        const excelHeaders: string[] = [];
        for (let i = 0; i < colCount; i++) {
          const val1 = row1[i] ? String(row1[i]).trim() : '';
          const val2 = row2[i] ? String(row2[i]).trim() : '';

          let header = '';
          if (val1 && val2) {
            // If both rows have text, combine them
            header = `${val1} ${val2}`;
          } else if (val1) {
            // Only first row has text
            header = val1;
          } else {
            // Only second row has text
            header = val2;
          }

          excelHeaders.push(header || `Column${i}`);
        }

        // Add "S.No." column at the start
        const headers = ["S.No.", ...excelHeaders];

        // 4. Extract data rows
        // Start extracting from headerRowIndex + 2 (skipping the 2 header rows)
        const rawDataRows = jsonData.slice(headerRowIndex + 2);
        
        let rowCounter = 0;
        const extractedData: InvoiceRow[] = rawDataRows.map((row) => {
          const rowObj: InvoiceRow = {};
          let hasData = false;

          excelHeaders.forEach((header, index) => {
            // Clean header name
            const cleanHeader = header ? header.trim() : `Column${index}`;
            const value = row[index];
            
            // Basic check if row has any content
            if (value !== '' && value !== null && value !== undefined) {
              hasData = true;
            }
            
            rowObj[cleanHeader] = value;
          });

          if (hasData) {
            rowCounter++;
            // Return object with S.No. at the start
            return { "S.No.": rowCounter, ...rowObj };
          }
          return null;
        }).filter((row): row is InvoiceRow => row !== null);

        // 5. Generate Markdown
        const markdown = generateMarkdownTable(headers, extractedData);

        return {
          headers,
          data: extractedData,
          markdown,
          sheetName: type // Use the standardized type name (B2B, B2B-CDNR) as sheet name
        };

    } catch (e) {
        console.error(`Error parsing sheet ${sheetName}`, e);
        return null;
    }
};

export const generateMarkdownTable = (headers: string[], data: InvoiceRow[]): string => {
  if (!headers.length) return '';

  const headerRow = `| ${headers.map(h => h.trim()).join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  
  const dataRows = data.map(row => {
    return `| ${headers.map(header => {
      const val = row[header.trim()];
      // Handle objects (like PDF file metadata) gracefully
      if (typeof val === 'object' && val !== null) {
        return '[Attachment]';
      }
      return val === undefined || val === null ? '' : String(val).replace(/\n/g, ' '); 
    }).join(' | ')} |`;
  }).join('\n');

  return `${headerRow}\n${separatorRow}\n${dataRows}`;
};
