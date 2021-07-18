import { subArr } from './subArr'

describe('subArr関数のテスト', () => {
  const leftArr = ['あ', 'い', 'う', 'え']
  const rightArr = ['あ', 'い', 'う']
  it('差分が返る', () => {
    expect(subArr(leftArr, rightArr)).toEqual(['え'])
  })
  it('何も返らない', () => {
    expect(subArr(rightArr, leftArr)).toEqual([])
  })
})
