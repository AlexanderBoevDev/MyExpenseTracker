declare module "papaparse" {
  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row: number;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: {
      delimiter: string;
      linebreak: string;
      aborted: boolean;
      fields: string[];
    };
  }

  export function parse<T>(
    csvString: string,
    options?: {
      header?: boolean;
      dynamicTyping?: boolean;
      skipEmptyLines?: boolean;
      complete?: (results: ParseResult<T>) => void;
    }
  ): ParseResult<T>;
}
