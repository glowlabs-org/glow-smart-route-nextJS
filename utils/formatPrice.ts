export const formatPrice = (price: string, toFixedPrecision: number) => {
  // Convert string to a floating-point number
  const priceNumber = parseFloat(price);

  // Check if the price is a whole number
  if (Math.floor(priceNumber) === priceNumber) {
    // If it's a whole number, return as a string without decimals
    return priceNumber.toString();
  } else {
    // If it's not a whole number, round down the number to the specified precision
    const roundedPrice =
      Math.floor(priceNumber * Math.pow(10, toFixedPrecision)) /
      Math.pow(10, toFixedPrecision);
    return roundedPrice.toString();
  }
};

//
