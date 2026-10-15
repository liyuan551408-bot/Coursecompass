<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  animate: { type: Boolean, default: false },
})
const emit = defineEmits(['complete'])

const displayedText = ref('')
const streaming = ref(false)
let timer

function stopTimer() {
  window.clearTimeout(timer)
  timer = undefined
}

function showText() {
  stopTimer()
  const fullText = props.text || ''
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  if (!props.animate || !fullText || reduceMotion) {
    displayedText.value = fullText
    streaming.value = false
    if (props.animate) emit('complete')
    return
  }

  displayedText.value = ''
  streaming.value = true
  let cursor = 0
  const chunkSize = Math.max(1, Math.ceil(fullText.length / 180))

  const revealNextChunk = () => {
    cursor = Math.min(fullText.length, cursor + chunkSize)
    displayedText.value = fullText.slice(0, cursor)
    if (cursor < fullText.length) {
      timer = window.setTimeout(revealNextChunk, 16)
      return
    }
    streaming.value = false
    emit('complete')
  }

  revealNextChunk()
}

watch(() => [props.text, props.animate], showText, { immediate: true })
onBeforeUnmount(stopTimer)
</script>

<template>
  <p class="streaming-text" :class="{ 'streaming-text--active': streaming }" :aria-label="text">
    <span aria-hidden="true">{{ displayedText }}</span>
  </p>
</template>

<style scoped>
.streaming-text { white-space: pre-wrap; }
.streaming-text--active::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 3px;
  border-radius: 2px;
  background: var(--accent);
  vertical-align: -.12em;
  animation: stream-caret .72s steps(1, end) infinite;
}
@keyframes stream-caret { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .streaming-text--active::after { animation: none; }
}
</style>
