import { useEffect, useState } from 'react'

const useDebounce = (value, { delay, ignore }) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ignore) return setDebouncedValue(value)

    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay, ignore])

  return debouncedValue
}

export default useDebounce
