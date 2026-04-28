import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
  header: string;
  getValue: (row: T) => string | number | null | undefined;
}

/**
 * Export an array of rows to an XLSX file and trigger a browser download.
 */
export function exportToXlsx<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
): void {
  const worksheetData = [
    columns.map((col) => col.header),
    ...rows.map((row) => columns.map((col) => col.getValue(row) ?? '')),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
