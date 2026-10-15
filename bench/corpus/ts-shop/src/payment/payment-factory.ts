import type { PaymentStrategy } from './payment-strategy';
import { CardPayment } from './card-payment';
import { PaypalPayment } from './paypal-payment';
import { StripeAdapter } from './stripe-adapter';

export class PaymentFactory {
  static createPayment(kind: 'card' | 'paypal' | 'stripe'): PaymentStrategy {
    if (kind === 'card') return new CardPayment();
    if (kind === 'paypal') return new PaypalPayment();
    return new StripeAdapter();
  }
}
