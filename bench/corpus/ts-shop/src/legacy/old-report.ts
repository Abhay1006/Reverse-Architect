// Nothing imports this file any more.
import { Order } from '../models/order';

export function printReport(orders: Order[]): string {
  return orders.map(o => o.total).join(',');
}
