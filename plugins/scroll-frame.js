const { addScrollListener, removeScrollListener } = require('@jamestomasino/scroll-frame')
export default ({ app }, inject) => {
  inject('addScrollListener', addScrollListener)
  inject('removeScrollListener', removeScrollListener)
}
