import { Order } from '../models/order';
import { User } from '../models/user';
import type { Database } from '../db/connection';
import type { EventBus } from '../events/event-bus';
import type { PaymentStrategy } from '../payment/payment-strategy';
import type { HttpRequest } from '../http/request-builder';

export class OrderService {
  constructor(private db: Database, private bus: EventBus) {}

  place(req: HttpRequest, payment: PaymentStrategy): Order {
    const user = new User(req.url);
    const order = new Order(user, 42);
    if (payment.pay(order.total)) {
      user.addOrder(order);
      this.db.save(order);
      this.bus.emit('order', order);
    }
    return order;
  }
}
