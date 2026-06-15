interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private users: User[] = [];

  async createUser(name: string, email: string): Promise<User> {
    const user: User = {
      id: this.users.length + 1,
      name,
      email,
    };
    this.users.push(user);
    return user;
  }

  async getUser(id: number): Promise<User | null> {
    return this.users.find((u) => u.id === id) || null;
  }

  async getAllUsers(): Promise<User[]> {
    return [...this.users];
  }

  async deleteUser(id: number): Promise<boolean> {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return false;
    this.users.splice(index, 1);
    return true;
  }
}

export { User, UserService };
