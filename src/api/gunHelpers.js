export function getNode(gun, path) {
  console.log('getNode called with path:', path);
  if (!gun) return null;
  if (!path) return gun;
  
  // Always use direct gun.get() for Gun paths - don't split on '/' 
  // because Gun treats the entire path as a single key
  console.log('getNode: using direct gun.get for path:', path);
  return gun.get(path);
}
