export default ({ app }) => {
  function loop () {
    const vh = window.innerHeight * 0.01
    document.documentElement.style.setProperty('--vh', `${vh}px`)
    window.requestAnimationFrame(loop)
  }
  window.requestAnimationFrame(loop)
}
