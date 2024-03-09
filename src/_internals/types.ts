export type Dict<T> = {
  [key: string]: T;
}


export type LooseAutocomplete<T extends string> = T | Omit<string, T>;
