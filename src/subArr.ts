export const subArr = (leftArr: string[], rightArr: string[]): string[] => {
  return leftArr.filter(leftVal => rightArr.indexOf(leftVal) === -1)
}
