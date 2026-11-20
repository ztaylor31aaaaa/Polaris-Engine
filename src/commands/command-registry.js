import { EventBus } from "../utils/events.js";

export class CommandRegistry {
  constructor() { this.commands = new Map(); this.events = new EventBus(); }
  register({ id, title, description = "", shortcut = "", run }) {
    if (!id || typeof run !== "function") throw new TypeError("Command id and run() are required.");
    if (this.commands.has(id)) throw new Error("Command already exists: " + id);
    const command = { id, title: String(title || id), description: String(description), shortcut, run };
    this.commands.set(id, command);
    this.events.emit("command:register", command);
    return () => this.unregister(id);
  }
  unregister(id) { const removed = this.commands.delete(id); if (removed) this.events.emit("command:unregister", { id }); return removed; }
  get(id) { return this.commands.get(id) || null; }
  list() { return [...this.commands.values()].map(({ run, ...item }) => item); }
  async execute(id, context = {}) {
    const command = this.get(id);
    if (!command) throw new Error("Command not found: " + id);
    this.events.emit("command:execute", { id });
    return command.run(context);
  }
}
