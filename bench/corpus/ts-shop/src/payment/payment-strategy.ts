export interface PaymentStrategy {
  pay(amount: number): boolean;
}
