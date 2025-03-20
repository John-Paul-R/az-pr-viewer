export interface PrFile {
  filename: string;
  path: string;
  pr_number: string;
}

// This can be expanded based on the structure of your PR JSON files
export interface PrData {
  [key: string]: any;
}
