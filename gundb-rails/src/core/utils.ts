export function pascalCase(str: string): string {
  return str
    .replace(/[-_ ]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

export function camelCase(str: string): string {
  const p = pascalCase(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
}
