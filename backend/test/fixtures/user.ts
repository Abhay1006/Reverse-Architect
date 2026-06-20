export interface User {
  id: string;
  name: string;
  email: string;
}

export class UserManager {
  private users: Map<string, User> = new Map();

  public addUser(user: User): void {
    this.users.set(user.id, user);
  }

  public getUser(id: string): User | undefined {
    return this.users.get(id);
  }
}
