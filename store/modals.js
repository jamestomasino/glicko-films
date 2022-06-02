export const state = () => ({
  showExitModal: false,
  showISI: false,
  exitLink: ''
})

export const mutations = {
  toggleISI: (state) => {
    state.showISI = !state.showISI
  },
  toggleExitModal: (state) => {
    state.showExitModal = !state.showExitModal
  },
  setExitModal: (state, status) => {
    if (status) {
      state.showExitModal = true
    } else {
      state.showExitModal = false
    }
  },
  setExitLink: (state, val) => {
    state.exitLink = val
  },
  setISI: (state, status) => {
    if (status) {
      state.showISI = true
    } else {
      state.showISI = false
    }
  }
}

export const getters = {
  showExitModal: (state) => {
    return state.showExitModal
  },
  showISI: (state) => {
    return state.showISI
  },
  exitLink: (state) => {
    return state.exitLink
  },
  isModalOpen: (state) => {
    return (
      state.showExitModal ||
      state.showISI
    )
  }
}
