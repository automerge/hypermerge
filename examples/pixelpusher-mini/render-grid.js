const chalk = require('chalk')

module.exports = renderGrid

function * renderGrid (state) {
  const {
    cursor: {x: cursorX, y: cursorY},
    grid: {x0y0, x0y1, x1y0, x1y1}
  } = state

  function c (color, selected) {
    let display
    let chalkChain = selected ? chalk.bold.underline : chalk
    switch (color) {
      case 'w':
        display = chalkChain.white('w')
        break
      case 'r':
        display = chalkChain.red('r')
        break
      case 'g':
        display = chalkChain.green('g')
        break
      case 'b':
        display = chalkChain.blue('b')
        break
      default:
        display = 'X'
    }
    return ` ${display} `
  }

  // Unicode Box Drawing: http://www.unicode.org/charts/PDF/U2500.pdf

  {
    // +---+---+
    const cursorLeftBox = (cursorX === 0 && cursorY === 0)
    const cursorRightBox = (cursorX === 1 && cursorY === 0)
    const downRight = cursorLeftBox ? '\u250f' : '\u250c'
    const horiz1 = cursorLeftBox ? '\u2501' : '\u2500'
    let downHoriz
    if (cursorLeftBox) downHoriz = '\u2531'
    else if (cursorRightBox) downHoriz = '\u2532'
    else downHoriz = '\u252c'
    const horiz2 = cursorRightBox ? '\u2501' : '\u2500'
    const downLeft = cursorRightBox ? '\u2513' : '\u2510'
    yield downRight + horiz1.repeat(3) + downHoriz +
          horiz2.repeat(3) + downLeft
  }

  {
    // | w | w |
    const cursorLeftBox = (cursorX === 0 && cursorY === 0)
    const cursorRightBox = (cursorX === 1 && cursorY === 0)
    const vert1 = cursorLeftBox ? '\u2503' : '\u2502'
    const vert2 = (cursorLeftBox || cursorRightBox) ? '\u2503' : '\u2502'
    const vert3 = cursorRightBox ? '\u2503' : '\u2502'
    yield vert1 + c(x0y0, cursorLeftBox) + vert2 +
          c(x1y0, cursorRightBox) + vert3
  }

  {
    // +---+---+
    const cursorUpperLeftBox = (cursorX === 0 && cursorY === 0)
    const cursorUpperRightBox = (cursorX === 1 && cursorY === 0)
    const cursorLowerLeftBox = (cursorX === 0 && cursorY === 1)
    const cursorLowerRightBox = (cursorX === 1 && cursorY === 1)
    let vertRight
    if (cursorUpperLeftBox) vertRight = '\u2521'
    else if (cursorLowerLeftBox) vertRight = '\u2522'
    else vertRight = '\u251c'
    const horiz1 = cursorX === 0 ? '\u2501' : '\u2500'
    let vertHoriz
    if (cursorUpperLeftBox) vertHoriz = '\u2543'
    else if (cursorUpperRightBox) vertHoriz = '\u2544'
    else if (cursorLowerLeftBox) vertHoriz = '\u2545'
    else if (cursorLowerRightBox) vertHoriz = '\u2546'
    else vertHoriz = '\u253c'
    const horiz2 = cursorX === 1 ? '\u2501' : '\u2500'
    let vertLeft
    if (cursorUpperRightBox) vertLeft = '\u2529'
    else if (cursorLowerRightBox) vertLeft = '\u252a'
    else vertLeft = '\u2524'
    yield vertRight + horiz1.repeat(3) + vertHoriz +
          horiz2.repeat(3) + vertLeft
  }

  {
    // | w | w |
    const cursorLeftBox = (cursorX === 0 && cursorY === 1)
    const cursorRightBox = (cursorX === 1 && cursorY === 1)
    const vert1 = cursorLeftBox ? '\u2503' : '\u2502'
    const vert2 = (cursorLeftBox || cursorRightBox) ? '\u2503' : '\u2502'
    const vert3 = cursorRightBox ? '\u2503' : '\u2502'
    yield vert1 + c(x0y1, cursorLeftBox) + vert2 +
          c(x1y1, cursorRightBox) + vert3
  }

  {
    // +---+---+
    const cursorLeftBox = (cursorX === 0 && cursorY === 1)
    const cursorRightBox = (cursorX === 1 && cursorY === 1)
    const upRight = cursorLeftBox ? '\u2517' : '\u2514'
    const horiz1 = cursorLeftBox ? '\u2501' : '\u2500'
    let upHoriz
    if (cursorLeftBox) upHoriz = '\u2539'
    else if (cursorRightBox) upHoriz = '\u253a'
    else upHoriz = '\u2534'
    const horiz2 = cursorRightBox ? '\u2501' : '\u2500'
    const upLeft = cursorRightBox ? '\u251b' : '\u2518'
    yield upRight + horiz1.repeat(3) + upHoriz +
          horiz2.repeat(3) + upLeft
  }
}
