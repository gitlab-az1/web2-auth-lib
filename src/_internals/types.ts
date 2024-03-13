export type Dict<T> = {
  [key: string]: T;
}


export type LooseAutocomplete<T extends string> = T | Omit<string, T>;

export type Writable<T> = {
  -readonly [P in keyof T]: T[P];
}
