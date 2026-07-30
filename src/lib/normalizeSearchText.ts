function normalizeSearchText(value: string | number): string {
  return value
    .toString()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export { normalizeSearchText }
