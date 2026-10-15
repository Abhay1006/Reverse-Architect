import type { PaymentStrategy } from './payment-strategy';

/** Adapts a third-party charge API to our PaymentStrategy. */
export class StripeAdapter implements PaymentStrategy {
  pay(amount: number): boolean {
    return this.charge(Math.round(amount * 100)) === 'succeeded';
  }
  private charge(cents: number): string {
    return cents > 0 ? 'succeeded' : 'failed';
  }
}
