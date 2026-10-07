export function isValidPhone(value) {
  if (typeof value !== 'string') return false
  const phone = value.trim()
  const digits = phone.match(/\d/g)?.length || 0
  return /^\+?[0-9()\s-]+$/.test(phone) && digits >= 7 && digits <= 15
}
