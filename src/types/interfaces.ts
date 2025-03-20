export interface PrFile {
  filename: string;
  path: string;
  pr_number: string;
  num: number;
  // Added fields from index data
  title?: string;
  author?: string;
  status?: string;
  creation_date?: string;
  repository?: string;
  source_branch?: string;
  target_branch?: string;
}

export interface PrIndexEntry {
  id: number;
  title: string;
  created_by: string;
  creation_date: string;
  status: string;
  repository: string;
  source_branch: string;
  target_branch: string;
  filename: string;
}
// This can be expanded based on the structure of your PR JSON files
export interface PrData {
  [key: string]: any;
}
