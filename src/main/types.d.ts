declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: any;
  }
  function pdfParse(buffer: Buffer): Promise<PDFData>;
  export = pdfParse;
}
