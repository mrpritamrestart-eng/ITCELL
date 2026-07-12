export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function positiveNumber(value: unknown, fieldName: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be greater than 0`);
  }
  return parsed;
}

export function nonNegativeNumber(value: unknown, fieldName: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }
  return parsed;
}
