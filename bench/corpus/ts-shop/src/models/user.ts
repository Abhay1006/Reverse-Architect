import { Order } from './order';

export class User {
  orders: Order[] = [];
  constructor(public name: string) {}
  addOrder(order: Order): void {
    this.orders.push(order);
  }
}
