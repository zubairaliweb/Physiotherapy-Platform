export function clinicDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: process.env.CLINIC_TIME_ZONE || 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function parseClinicDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return date.toISOString().slice(0, 10) === value ? date : null
}

export function isPastClinicDate(value, now = new Date()) {
  return typeof value === 'string' && value < clinicDateString(now)
}
