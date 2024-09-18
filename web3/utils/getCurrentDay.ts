/**
 * TODO: Make sure this day starts from the genesis timestamp when refactoring the db.
 * @returns {number} The number of days since the unix epoch start.
 */
export const getCurrentDay = () => {
    const secondsSinceEpochStart = new Date().getTime() / 1000
    const daysSinceEpochStart = Math.floor(secondsSinceEpochStart / 86400)
    return daysSinceEpochStart
}
