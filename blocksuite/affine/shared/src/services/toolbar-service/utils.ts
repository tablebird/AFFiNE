export function generateActionIdWith(
  flavour: string,
  name: string,
  prefix = 'com.affine.toolbar.internal'
) {
  return `${prefix}.${flavour}.${name}`;
}
