export function toFixedTruncate(
  num: number,
  places: number,
  withSeparator: boolean = false
): string {
  const factor = Math.pow(10, places);
  // Truncate the number to the desired places
  const truncated = Math.floor(num * factor) / factor;
  // Convert to string with the specified number of decimal places
  const fixedString = truncated.toFixed(places);

  // Check if withSeparator is true, then format with comma separators
  if (withSeparator) {
    return Number(fixedString).toLocaleString("en-US", {
      minimumFractionDigits: places,
      maximumFractionDigits: places,
    });
  } else {
    // Return the number as a string without comma separators
    return fixedString;
  }
}
