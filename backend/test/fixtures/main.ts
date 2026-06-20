import { UserManager } from './user.js';
import { generateId } from './utils.js';

function main() {
  const manager = new UserManager();
  const id = generateId();
  manager.addUser({
    id,
    name: "Test User",
    email: "test@example.com"
  });
  console.log("User added!");
}

main();
