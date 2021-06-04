function chunk (array, chunkSize) {
  return array.reduce((result, item, index) => {
    const chunkIndex = Math.floor(index / chunkSize)

    if (!result[chunkIndex]) {
      result[chunkIndex] = []
    }

    result[chunkIndex].push(item)

    return result
  }, [])
}

module.exports = {
  chunk
}
