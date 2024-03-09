export function convertUint8ArrayToHex(arr: Uint8Array): string {
  return Array.prototype.map.call(arr, function(byte) {
    return ('0' + byte.toString(16)).slice(-2);
  }).join('');
}

export function removeDuplicates<T>(arr: Array<T>, key: keyof T): Array<T> {
  const unique: Record<any, boolean> = {};

  return arr.filter(item => {
    if(unique[item[key]] === true) return false;
    
    unique[item[key] as any] = true;
    return true;
  });
}


/**
 * Checks if the value is a string.
 * 
 * @param {*} value The value to be checked
 * @returns {boolean} True if the value is a string, false otherwise
 */
export function isString(value: unknown): value is string {
  return (
    typeof value === 'string' ||
    (value instanceof String)
  );
}


/**
 * Checks if the value is a number.
 * 
 * @param {*} value The value to be checked 
 * @returns {boolean} True if the value is a number, false otherwise
 */
export function isDigit(value: unknown): value is number {
  return (
    typeof value === 'number' ||
    (value instanceof Number)
  ) && !Number.isNaN(value);
} 
