import { OrderService } from './services/order-service';
import { EventBus } from './events/event-bus';
import { Database } from './db/connection';
import { RequestBuilder } from './http/request-builder';
import { PaymentFactory } from './payment/payment-factory';
import { formatMoney } from './util/format';

export function startApp(): void {
  const bus = new EventBus();
  bus.subscribe('order', (o) => console.log(formatMoney(o.total)));
  const service = new OrderService(Database.getInstance(), bus);
  const payment = PaymentFactory.createPayment('card');
  const req = new RequestBuilder().withUrl('/orders').withMethod('POST').build();
  service.place(req, payment);
}
