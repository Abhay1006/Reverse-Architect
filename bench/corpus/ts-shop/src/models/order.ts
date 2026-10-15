import { User } from './user';

export class Order {
  constructor(public owner: User, public total: number) {}
  belongsTo(user: User): boolean {
    return this.owner === user;
  }
}
