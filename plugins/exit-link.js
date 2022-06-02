export default ({ store }, inject) => {
  inject('exitlink', exitlink)

  function exitlink (e) {
    const href = gethref(e.target)
    store.commit('modals/setExitLink', href)
    store.commit('modals/setExitModal', true)
    e.preventDefault()
  }

  function gethref (e) {
    return e.href || gethref(e.parentNode)
  }
}
