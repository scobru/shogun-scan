export function getNode(gun, path) {
  if (!gun) return null;
  if (!path) return gun;
  if (path.includes('/') && !path.includes('#')) {
    return path.split('/').reduce((node, part) => node.get(part), gun);
  }
  return gun.get(path);
}
