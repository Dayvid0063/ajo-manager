// app/composables/useForm.js
// Small form helper: validates with the SAME shared Zod schema the server uses,
// submits, and maps server errors (field + general) back onto the form.
import { toFieldErrors } from '#shared/utils/zod'

export function useForm(schema, initial) {
  const values = reactive({ ...initial })
  const errors = ref({})
  const formError = ref('')
  const pending = ref(false)

  function fieldError(name) {
    return errors.value[name]?.[0] ?? ''
  }

  function validate() {
    const result = schema.safeParse(values)
    errors.value = result.success ? {} : toFieldErrors(result.error)
    return result.success ? result.data : null
  }

  async function submit(action) {
    formError.value = ''
    const data = validate()
    if (!data) return null
    pending.value = true
    try {
      return await action(data)
    } catch (error) {
      const body = error?.data
      const fields = body?.data?.fields
      if (fields) errors.value = fields
      formError.value = fields ? '' : body?.message || 'Something went wrong. Please try again.'
      return null
    } finally {
      pending.value = false
    }
  }

  return { values, errors, formError, pending, fieldError, validate, submit }
}
