const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const XLSX = require('xlsx');

const fileService = {
  /**
   * Parse a CSV file using streaming for large files
   * Returns all rows as an array of objects
   */
  parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const fileStream = fs.createReadStream(filePath, 'utf8');

      Papa.parse(fileStream, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        step: (row) => {
          results.push(row.data);
        },
        complete: () => {
          resolve(results);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  },

  /**
   * Parse an Excel file
   */
  parseExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  },

  /**
   * Parse file based on extension
   */
  async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') {
      return this.parseCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      return this.parseExcel(filePath);
    }
    throw new Error(`Unsupported file format: ${ext}`);
  },

  /**
   * Get preview of first N rows from file
   */
  async getPreview(filePath, rows = 20) {
    const allData = await this.parseFile(filePath);
    const headers = allData.length > 0 ? Object.keys(allData[0]) : [];
    return {
      headers,
      rows: allData.slice(0, rows),
      totalRows: allData.length,
    };
  },

  /**
   * Apply column mapping to raw data
   * Maps user-defined column names to system field names
   */
  applyMapping(row, mapping) {
    const mapped = {};
    for (const [systemField, csvColumn] of Object.entries(mapping)) {
      if (csvColumn && row[csvColumn] !== undefined) {
        mapped[systemField] = row[csvColumn];
      }
    }
    return mapped;
  },
};

module.exports = fileService;
