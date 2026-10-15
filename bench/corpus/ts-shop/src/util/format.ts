/** Negative control: method names that used to trip the observer detector. */
export class MoneyFormatter {
  constructor(private currency: string) {}
  toJSON(): string {
    return this.currency;
  }
  format(value: number): string {
    return `${value.toFixed(2)} ${this.currency}`;
  }
}

export function formatMoney(value: number): string {
  return new MoneyFormatter('USD').format(value);
}
