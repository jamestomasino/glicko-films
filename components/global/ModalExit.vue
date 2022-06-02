<template>
  <client-only>
    <focus-trap
      :active="showExitModal"
      @deactivate="setExitModal(false)"
    >
      <div
        v-show="showExitModal"
        tabindex="-1"
        :class="{ active : showExitModal }"
        class="generic-modal-blur"
      >
        <div class="generic-modal">
          <div class="generic-modal-content-container">
            <p>
              You are now leaving DOMAIN.com
            </p>
            <div class="buttons">
              <a
                ref="continue"
                rel="noopener nofollow"
                tabindex="0"
                class="continue-btn"
                :href="exitLink"
                target="_blank"
                @click="setExitModal(false)"
              >
                Continue
              </a>
              <button
                tabindex="0"
                class="close-btn"
                @click="setExitModal(false)"
                @keyup.enter="setExitModal(false)"
              >
                Cancel
              </button>
            </div>
          </div>
          <button
            tabindex="0"
            class="close-x"
            @click="setExitModal(false)"
            @keyup.enter="setExitModal(false)"
          >
            <div class="line" />
          </button>
        </div>
      </div>
    </focus-trap>
  </client-only>
</template>

<script>
import { mapGetters, mapMutations } from 'vuex'

export default {
  name: 'ModalExit',
  computed: {
    ...mapGetters('modals', ['showExitModal', 'exitLink'])
  },
  methods: {
    ...mapMutations('modals', ['setExitModal'])
  }
}
</script>
