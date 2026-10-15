<script setup>
import { computed, ref } from 'vue'
import { dedupeKeywords, suggestKeywords } from '../utils/profileKeywords'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  vocabulary: { type: Array, required: true },
  placeholder: { type: String, default: 'Type or choose a keyword' },
  disabled: { type: Boolean, default: false },
  limit: { type: Number, default: 20 },
})
const emit = defineEmits(['update:modelValue'])
const searchText = ref('')

const suggestions = computed(() => suggestKeywords(searchText.value, props.vocabulary, props.modelValue))

function update(values) {
  emit('update:modelValue', dedupeKeywords(values).slice(0, props.limit))
  searchText.value = ''
}
</script>

<template>
  <el-select
    :model-value="modelValue"
    multiple
    filterable
    allow-create
    default-first-option
    :reserve-keyword="false"
    :multiple-limit="limit"
    :placeholder="placeholder"
    :disabled="disabled"
    :filter-method="value => { searchText = value }"
    style="width: 100%"
    @update:model-value="update"
  >
    <el-option v-for="item in suggestions" :key="item" :label="item" :value="item" />
  </el-select>
</template>
