import type { PaymentStrategy } from './payment-strategy';

export class CardPayment implements PaymentStrategy {
  pay(amount: number): boolean {
    return amount > 0;
  }
}
