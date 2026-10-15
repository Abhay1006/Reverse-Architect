import type { PaymentStrategy } from './payment-strategy';

export class PaypalPayment implements PaymentStrategy {
  pay(amount: number): boolean {
    return amount < 10000;
  }
}
