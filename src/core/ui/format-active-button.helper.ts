export function formatActiveButton(label: string, active: boolean) {
  return active ? `« ${label} »` : label;
}
